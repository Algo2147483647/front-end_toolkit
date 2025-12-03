// 全局状态管理
const state = {
  formSchema: {
    form: {
      labelCol: 4,
      wrapperCol: 18
    },
    schema: {
      type: "object",
      properties: {}
    }
  },
  selectedItem: null,
  components: [],
  nextId: 1,
  showBorders: false  // 控制是否显示边框
};

// 组件配置映射
const componentConfigs = {
  Input: {
    name: "input",
    title: "输入框",
    defaultValue: "",
    placeholder: "请输入",
    required: false,
    type: "string"
  },
  Textarea: {
    name: "textarea",
    title: "多行文本框",
    defaultValue: "",
    placeholder: "请输入",
    required: false,
    type: "string"
  },
  InputNumber: {
    name: "number",
    title: "数字输入框",
    defaultValue: 0,
    type: "number"
  },
  Select: {
    name: "select",
    title: "选择器",
    defaultValue: "",
    options: ["选项1", "选项2", "选项3"],
    type: "string"
  },
  DatePicker: {
    name: "date",
    title: "日期选择器",
    type: "string"
  },
  TimePicker: {
    name: "time",
    title: "时间选择器",
    type: "string"
  },
  Card: {
    name: "card",
    title: "",
    type: "void",
    properties: {}
  },
  Divider: {
    name: "divider",
    title: "",
    type: "void",
    content: "", // 默认无文字
  },
  Grid: {
    name: "grid",
    title: "",
    type: "void",
    columns: 3, // 默认3列
  },
  Switch: {
    name: "switch",
    title: "开关",
    defaultValue: false,
    type: "boolean"
  },
  Slider: {
    name: "slider",
    title: "滑动输入条",
    defaultValue: 0,
    min: 0,
    max: 100,
    type: "number"
  },
  Radio: {
    name: "radio",
    title: "单选框",
    defaultValue: "",
    options: ["选项1", "选项2"],
    type: "string"
  },
  Checkbox: {
    name: "checkbox",
    title: "多选框",
    defaultValue: [],
    options: ["选项1", "选项2", "选项3"],
    type: "array"
  }
};

// 根据ID查找组件（包括嵌套组件）
function findComponentById(id) {
  // 在根级别查找
  for (const component of state.components) {
    if (component.id === id) {
      return component;
    }
    
    // 在容器组件的子组件中查找
    if (component.children) {
      const found = findComponentInContainer(component.children, id);
      if (found) {
        return found;
      }
    }
  }
  
  return null;
}

// 在容器中递归查找组件
function findComponentInContainer(children, id) {
  for (const child of children) {
    if (child.id === id) {
      return child;
    }
    
    if (child.children) {
      const found = findComponentInContainer(child.children, id);
      if (found) {
        return found;
      }
    }
  }
  
  return null;
}

// 更新 JSON Schema
function updateSchema() {
  const properties = {};

  state.components.forEach((comp, index) => {
    const fieldId = comp.config.name.replace(/[^a-zA-Z0-9]/g, '') + '_' + comp.id;

    properties[fieldId] = {
      name: comp.config.name,
      type: comp.config.type,
      title: comp.config.title,
      "x-index": index,
      "x-component": comp.type,
      "x-decorator": "FormItem",
      "x-component-props": {},
      "x-validator": []
    };

    // 添加特定属性
    if (comp.config.placeholder) {
      properties[fieldId]["x-component-props"].placeholder = comp.config.placeholder;
    }

    if (comp.config.options && comp.config.options.length > 0) {
      properties[fieldId]["x-component-props"].options = comp.config.options.map(opt => ({
        label: opt,
        value: opt
      }));
    }

    if (comp.type === 'Divider') {
      properties[fieldId]["x-component-props"].content = comp.config.content;
    }
    
    if (comp.type === 'Card') {
      properties[fieldId]["x-component-props"].title = comp.config.showTitle ? comp.config.title : undefined;
      // 处理子组件
      if (comp.children && comp.children.length > 0) {
        properties[fieldId].properties = {};
        comp.children.forEach((child, childIndex) => {
          const childFieldId = child.config.name.replace(/[^a-zA-Z0-9]/g, '') + '_' + child.id;
          properties[fieldId].properties[childFieldId] = {
            name: child.config.name,
            type: child.config.type,
            title: child.config.title,
            "x-index": childIndex,
            "x-component": child.type,
            "x-decorator": "FormItem",
            "x-component-props": {},
            "x-validator": []
          };
          
          if (child.config.placeholder) {
            properties[fieldId].properties[childFieldId]["x-component-props"].placeholder = child.config.placeholder;
          }
          
          if (child.config.options && child.config.options.length > 0) {
            properties[fieldId].properties[childFieldId]["x-component-props"].options = child.config.options.map(opt => ({
              label: opt,
              value: opt
            }));
          }
          
          if (child.config.required) {
            properties[fieldId].properties[childFieldId].required = true;
            properties[fieldId].properties[childFieldId]["x-validator"].push({
              ruleKey: "required"
            });
          }
        });
      }
    }
    
    if (comp.type === 'Grid') {
      properties[fieldId]["x-component-props"].columns = comp.config.columns;
      properties[fieldId]["x-component-props"].title = comp.config.showTitle ? comp.config.title : undefined;
      // 处理子组件
      if (comp.children && comp.children.length > 0) {
        properties[fieldId].properties = {};
        comp.children.forEach((child, childIndex) => {
          const childFieldId = child.config.name.replace(/[^a-zA-Z0-9]/g, '') + '_' + child.id;
          properties[fieldId].properties[childFieldId] = {
            name: child.config.name,
            type: child.config.type,
            title: child.config.title,
            "x-index": childIndex,
            "x-component": child.type,
            "x-decorator": "FormItem",
            "x-component-props": {},
            "x-validator": []
          };
          
          if (child.config.placeholder) {
            properties[fieldId].properties[childFieldId]["x-component-props"].placeholder = child.config.placeholder;
          }
          
          if (child.config.options && child.config.options.length > 0) {
            properties[fieldId].properties[childFieldId]["x-component-props"].options = child.config.options.map(opt => ({
              label: opt,
              value: opt
            }));
          }
          
          if (child.config.required) {
            properties[fieldId].properties[childFieldId].required = true;
            properties[fieldId].properties[childFieldId]["x-validator"].push({
              ruleKey: "required"
            });
          }
        });
      }
    }

    if (comp.config.required) {
      properties[fieldId].required = true;
      properties[fieldId]["x-validator"].push({
        ruleKey: "required"
      });
    }
  });

  state.formSchema.schema.properties = properties;
}

// 选择组件
function selectComponent(component) {
  state.selectedItem = component;
  renderFormItems();
  renderProperties();
  renderComponentTree(); // 更新组件树选中状态
}

// 暴露到全局作用域
window.state = state;
window.componentConfigs = componentConfigs;
window.findComponentById = findComponentById;
window.updateSchema = updateSchema;
window.selectComponent = selectComponent;