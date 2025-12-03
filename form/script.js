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

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  initDragAndDrop();
  initEventListeners();
  renderFormItems();
  initTabs(); // 初始化标签页
});

// 初始化标签页
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.panel-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // 更新激活的标签按钮
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // 显示对应的面板
      tabPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === tabName + 'Panel') {
          panel.classList.add('active');
        }
      });

      // 如果是组件树面板，则更新树结构
      if (tabName === 'tree') {
        renderComponentTree();
      }
    });
  });

  // 初始化边框切换按钮
  const toggleButton = document.getElementById('toggleBorders');
  toggleButton.addEventListener('click', function() {
    state.showBorders = !state.showBorders;
    const icon = this.querySelector('i');
    if (state.showBorders) {
      icon.className = 'fas fa-border-none';
      this.title = '隐藏边框';
    } else {
      icon.className = 'fas fa-border-all';
      this.title = '显示边框';
    }
    renderFormItems();
  });
}

// 初始化拖拽功能
function initDragAndDrop() {
  const components = document.querySelectorAll('.component-item');
  const canvas = document.getElementById('formCanvas');

  components.forEach(component => {
    component.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('componentType', this.dataset.type);
      this.classList.add('dragging');
    });

    component.addEventListener('dragend', function() {
      this.classList.remove('dragging');
    });
  });

  canvas.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.classList.add('active');
  });

  canvas.addEventListener('dragleave', function() {
    this.classList.remove('active');
  });

  canvas.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('active');

    const componentType = e.dataTransfer.getData('componentType');
    if (componentType) {
      addComponent(componentType);
    }
  });
  
  // 添加对容器组件内部拖拽的支持
  document.addEventListener('dragover', function(e) {
    if (e.target.classList.contains('container-drop-area')) {
      e.preventDefault();
      e.target.classList.add('active');
    }
  });

  document.addEventListener('dragleave', function(e) {
    if (e.target.classList.contains('container-drop-area')) {
      e.target.classList.remove('active');
    }
  });

  document.addEventListener('drop', function(e) {
    if (e.target.classList.contains('container-drop-area')) {
      e.preventDefault();
      e.target.classList.remove('active');

      const componentType = e.dataTransfer.getData('componentType');
      const containerId = e.target.dataset.containerId;
      
      if (componentType && containerId) {
        addComponentToContainer(containerId, componentType);
      }
    }
  });
  
  // 添加对容器内组件拖拽排序的支持
  document.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('form-item') && e.target.parentNode.classList.contains('card-preview')) {
      e.dataTransfer.setData('text/plain', e.target.dataset.id);
    }
  });
  
  document.addEventListener('dragover', function(e) {
    if (e.target.classList.contains('card-preview')) {
      e.preventDefault();
    }
  });
}

// 添加组件
function addComponent(type) {
  const id = 'comp_' + state.nextId++;
  const config = JSON.parse(JSON.stringify(componentConfigs[type]));

  const component = {
    id,
    type,
    config: {
      ...config,
      name: config.name + '_' + id
    },
    position: state.components.length,
    children: (type === 'Card' || type === 'Grid') ? [] : undefined // 容器组件支持子组件
  };

  state.components.push(component);
  selectComponent(component);
  renderFormItems();
  renderComponentTree(); // 更新组件树
  updateSchema();
}

// 向容器组件添加子组件
function addComponentToContainer(containerId, type) {
  const container = findComponentById(containerId);
  if (!container) return;

  const id = 'comp_' + state.nextId++;
  const config = JSON.parse(JSON.stringify(componentConfigs[type]));

  const childComponent = {
    id,
    type,
    config: {
      ...config,
      name: config.name + '_' + id
    },
    position: container.children.length
  };

  // 对于栅格组件，我们需要记录它属于哪一列
  if (container.type === 'Grid') {
    // 查找最少元素的列
    const columns = container.config.columns || 3;
    let minCount = Infinity;
    let targetColumn = 0;
    
    for (let i = 0; i < columns; i++) {
      const count = container.children.filter(child => child.position === i).length;
      if (count < minCount) {
        minCount = count;
        targetColumn = i;
      }
    }
    
    childComponent.position = targetColumn;
  }

  container.children.push(childComponent);
  selectComponent(container);
  renderFormItems();
  renderComponentTree(); // 更新组件树
  updateSchema();
}

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

// 渲染表单项目
function renderFormItems() {
  const container = document.getElementById('formItems');
  const emptyCanvas = document.getElementById('emptyCanvas');

  if (state.components.length === 0) {
    emptyCanvas.style.display = 'flex';
    container.innerHTML = '';
    return;
  }

  emptyCanvas.style.display = 'none';
  container.innerHTML = state.components.map(comp => `
              <div class="form-item ${state.selectedItem?.id === comp.id ? 'selected' : ''} ${state.showBorders ? 'with-borders' : ''}"
                   data-id="${comp.id}"
                   draggable="true">
                  <span class="form-item-label">${comp.config.title}</span>
                  <div class="form-item-content">
                      ${renderComponentPreview(comp)}
                  </div>
                  <div class="form-item-actions">
                      <i class="fas fa-edit form-item-action" onclick="editComponent('${comp.id}')"></i>
                      <i class="fas fa-trash form-item-action" onclick="deleteComponent('${comp.id}')"></i>
                      <i class="fas fa-arrows-alt form-item-action"
                         onmousedown="startDrag(event, '${comp.id}')"></i>
                  </div>
              </div>
          `).join('');

  // 添加点击选择事件
  container.querySelectorAll('.form-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (!e.target.closest('.form-item-action')) {
        const id = this.dataset.id;
        const component = state.components.find(c => c.id === id);
        selectComponent(component);
      }
    });
  });
}

// 获取组件图标
function getComponentIcon(type) {
  const icons = {
    Input: 'font',
    Textarea: 'align-left',
    InputNumber: 'sort-numeric-up',
    Select: 'list',
    DatePicker: 'calendar-alt',
    TimePicker: 'clock',
    Card: 'square',
    Divider: 'minus',
    Switch: 'toggle-on',
    Slider: 'sliders-h',
    Radio: 'dot-circle',
    Checkbox: 'check-square'
  };
  return icons[type] || 'cube';
}

// 渲染组件预览
function renderComponentPreview(component) {
  switch(component.type) {
    case 'Input':
      return `<input type="text" class="ant-input" placeholder="${component.config.placeholder}" disabled>`;
    case 'Textarea':
      return `<textarea class="ant-input" placeholder="${component.config.placeholder}" disabled style="height: 80px;"></textarea>`;
    case 'InputNumber':
      return `
        <div class="number-input-wrapper">
          <input type="number" class="ant-input" value="${component.config.defaultValue}" disabled>
          <div class="number-input-controls">
            <button class="number-input-control number-input-control-up" disabled>▲</button>
            <button class="number-input-control number-input-control-down" disabled>▼</button>
          </div>
        </div>`;
    case 'Select':
      return `<select class="ant-select" disabled>
                      ${component.config.options.map(opt => `<option>${opt}</option>`).join('')}
                  </select>`;
    case 'DatePicker':
      return `<div class="date-picker-preview">
                  <i class="fas fa-calendar-alt"></i>
                  <span>请选择日期</span>
              </div>`;
    case 'TimePicker':
      return `<div class="date-picker-preview">
                  <i class="fas fa-clock"></i>
                  <span>请选择时间</span>
              </div>`;
    case 'Card':
      return `<div class="card-preview ${component.config.showTitle ? 'with-title' : ''} ${state.showBorders ? 'with-borders' : ''}">
                  ${component.children && component.children.length > 0 
                    ? component.children.map(child => 
                        `<div class="form-item ${state.selectedItem?.id === child.id ? 'selected' : ''}" 
                             data-id="${child.id}"
                             draggable="true"
                             style="margin-bottom: 10px;">
                           <span class="form-item-label">${child.config.title}</span>
                           <div class="form-item-content">
                               ${renderComponentPreview(child)}
                           </div>
                           <div class="form-item-actions">
                               <i class="fas fa-edit form-item-action" onclick="editComponent('${child.id}')"></i>
                               <i class="fas fa-trash form-item-action" onclick="deleteChildComponent('${component.id}', '${child.id}')"></i>
                           </div>
                        </div>`
                      ).join('')
                    : ''}
                  <div class="container-drop-area" data-container-id="${component.id}">
                     拖拽组件到此处添加到卡片中
                  </div>
              </div>`;
    case 'Divider':
      if (component.config.content) {
        return `<div class="divider-preview"><span>${component.config.content}</span></div>`;
      } else {
        return `<div class="divider-preview no-title"><span></span></div>`;
      }
    case 'Grid':
      const columns = component.config.columns || 3;
      let gridCols = '';
      for (let i = 0; i < columns; i++) {
        const colChildren = component.children ? component.children.filter(child => child.position === i) : [];
        gridCols += `<div class="grid-column">
                      ${colChildren.length > 0 
                        ? colChildren.map(child => 
                            `<div class="form-item ${state.selectedItem?.id === child.id ? 'selected' : ''}" 
                                 data-id="${child.id}"
                                 draggable="true">
                              <span class="form-item-label">${child.config.title}</span>
                              <div class="form-item-content">
                                  ${renderComponentPreview(child)}
                              </div>
                              <div class="form-item-actions">
                                  <i class="fas fa-edit form-item-action" onclick="editComponent('${child.id}')"></i>
                                  <i class="fas fa-trash form-item-action" onclick="deleteChildComponent('${component.id}', '${child.id}')"></i>
                              </div>
                            </div>`)
                        : ''}
                      <div class="container-drop-area" data-container-id="${component.id}" data-column="${i}">
                         拖拽组件到此列
                      </div>
                    </div>`;
      }
      return `<div class="grid-preview ${state.showBorders ? 'with-borders' : ''}">
                  <div class="grid-columns">${gridCols}</div>
              </div>`;
    case 'Switch':
      return `<button class="ant-switch" style="vertical-align: middle;" disabled></button>`;
    case 'Radio':
      const radioOptions = component.config.options || ['选项1', '选项2'];
      return `<div class="radio-preview">
                ${radioOptions.map((opt, idx) => `
                  <div class="radio-option">
                    <input type="radio" name="radio_${component.id}" ${idx === 0 ? 'checked' : ''} disabled>
                    <label>${opt}</label>
                  </div>
                `).join('')}
              </div>`;
    case 'Checkbox':
      const checkboxOptions = component.config.options || ['选项1', '选项2', '选项3'];
      return `<div class="checkbox-preview">
                ${checkboxOptions.map(opt => `
                  <div class="checkbox-option">
                    <input type="checkbox" disabled>
                    <label>${opt}</label>
                  </div>
                `).join('')}
              </div>`;
    default:
      return `<span style="color: #999;">${component.type} 组件预览</span>`;
  }
}

// 渲染组件树
function renderComponentTree() {
  const treeContainer = document.getElementById('componentTree');
  
  if (state.components.length === 0) {
    treeContainer.innerHTML = '<li class="tree-empty">暂无组件</li>';
    return;
  }

  treeContainer.innerHTML = state.components.map(component => renderTreeNode(component, 0)).join('');
  
  // 添加节点点击事件
  treeContainer.querySelectorAll('.tree-node').forEach(node => {
    node.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = this.dataset.id;
      const component = findComponentById(id);
      if (component) {
        selectComponent(component);
        // 不再切换到组件库面板，保持当前面板状态
        // 只需要确保组件树面板是激活的即可
      }
    });
  });
}

// 渲染树节点
function renderTreeNode(component, level) {
  const isSelected = state.selectedItem?.id === component.id;
  const icon = getComponentIcon(component.type);
  const hasChildren = component.children && component.children.length > 0;
  
  let html = `
    <li>
      <div class="tree-node ${isSelected ? 'selected' : ''}" data-id="${component.id}">
        ${hasChildren ? '<i class="tree-expand-icon fas fa-caret-right"></i>' : '<i class="tree-expand-icon-placeholder"></i>'}
        <i class="node-icon fas fa-${icon}"></i>
        <span class="node-label">${component.config.title || component.type}</span>
        <span class="node-type">${component.type}</span>
      </div>
  `;
  
  // 渲染子节点
  if (hasChildren) {
    html += `<ul>`;
    component.children.forEach(child => {
      html += renderTreeNode(child, level + 1);
    });
    html += `</ul>`;
  }
  
  html += `</li>`;
  return html;
}

// 选择组件
function selectComponent(component) {
  state.selectedItem = component;
  renderFormItems();
  renderProperties();
  renderComponentTree(); // 更新组件树选中状态
}

// 渲染属性面板
function renderProperties() {
  const container = document.getElementById('propertiesContent');

  if (!state.selectedItem) {
    container.innerHTML = '<p style="color: #999; text-align: center;">请选择一个组件进行配置</p>';
    return;
  }

  const comp = state.selectedItem;
  let propertiesHTML = `
              <div class="property-field">
                  <label class="property-label">组件类型</label>
                  <input class="ant-input" value="${comp.type}" disabled>
              </div>
              <div class="property-field">
                  <label class="property-label">字段名称</label>
                  <input class="ant-input" value="${comp.config.name}"
                         onchange="updateProperty('name', this.value)">
              </div>
              <div class="property-field">
                  <label class="property-label">显示标题</label>
                  <input class="ant-input" value="${comp.config.title}"
                         onchange="updateProperty('title', this.value)">
              </div>`;

  // 对于布局组件，添加特殊配置项
  if (comp.type === 'Card' || comp.type === 'Divider' || comp.type === 'Grid') {
    propertiesHTML += `
                <div class="property-field">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" ${comp.config.showTitle ? 'checked' : ''}
                               onchange="updateProperty('showTitle', this.checked)">
                        <span>显示主标题</span>
                    </label>
                </div>`;
  }

  if (comp.type === 'Input') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">占位提示</label>
                      <input class="ant-input" value="${comp.config.placeholder || ''}"
                             onchange="updateProperty('placeholder', this.value)">
                  </div>`;
  }
  
  if (comp.type === 'Textarea') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">占位提示</label>
                      <input class="ant-input" value="${comp.config.placeholder || ''}"
                             onchange="updateProperty('placeholder', this.value)">
                  </div>`;
  }

  if (comp.type === 'Select' || comp.type === 'Radio') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">选项配置</label>
                      <textarea class="ant-input" style="height: 80px;"
                                onchange="updateProperty('options', this.value.split('\n'))">${(comp.config.options || []).join('\n')}</textarea>
                      <p style="font-size: 12px; color: #999; margin-top: 4px;">每行一个选项</p>
                  </div>`;
  }

  if (comp.type === 'Checkbox') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">选项配置</label>
                      <textarea class="ant-input" style="height: 80px;"
                                onchange="updateProperty('options', this.value.split('\n'))">${(comp.config.options || []).join('\n')}</textarea>
                      <p style="font-size: 12px; color: #999; margin-top: 4px;">每行一个选项</p>
                  </div>`;
  }

  if (comp.type === 'Divider') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">分割线文字</label>
                      <input class="ant-input" value="${comp.config.content || ''}"
                             onchange="updateProperty('content', this.value)">
                  </div>`;
  }
  
  if (comp.type === 'Grid') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">列数</label>
                      <input type="number" class="ant-input" min="1" max="12" value="${comp.config.columns || 3}"
                             onchange="updateProperty('columns', parseInt(this.value))">
                  </div>`;
  }

  if (comp.type !== 'Divider' && comp.type !== 'Card' && comp.type !== 'Grid') {
    propertiesHTML += `
                  <div class="property-field">
                      <label style="display: flex; align-items: center; gap: 8px;">
                          <input type="checkbox" ${comp.config.required ? 'checked' : ''}
                                 onchange="updateProperty('required', this.checked)">
                          <span>是否必填</span>
                      </label>
                  </div>
                  <div class="property-field">
                      <label class="property-label">默认值</label>
                      <input class="ant-input" value="${comp.config.defaultValue || ''}"
                             onchange="updateProperty('defaultValue', this.value)">
                  </div>`;
  }

  container.innerHTML = propertiesHTML;
}

// 更新组件属性
function updateProperty(key, value) {
  if (state.selectedItem) {
    state.selectedItem.config[key] = value;
    renderFormItems();
    renderComponentTree(); // 更新组件树
    updateSchema();
  }
}

// 编辑组件
function editComponent(id) {
  const component = state.components.find(c => c.id === id);
  selectComponent(component);
}

// 删除组件
function deleteComponent(id) {
  const index = state.components.findIndex(c => c.id === id);
  if (index > -1) {
    state.components.splice(index, 1);
    if (state.selectedItem?.id === id) {
      state.selectedItem = null;
    }
    renderFormItems();
    renderProperties();
    renderComponentTree(); // 更新组件树
    updateSchema();
  }
}

// 删除容器中的子组件
function deleteChildComponent(containerId, childId) {
  const container = findComponentById(containerId);
  if (container && container.children) {
    const index = container.children.findIndex(c => c.id === childId);
    if (index > -1) {
      container.children.splice(index, 1);
      
      // 更新选中状态
      if (state.selectedItem?.id === childId) {
        state.selectedItem = null;
        renderProperties();
      }
      
      renderFormItems();
      renderComponentTree();
      updateSchema();
    }
  }
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

// 初始化事件监听器
function initEventListeners() {
  // 导出按钮
  document.getElementById('exportBtn').addEventListener('click', function() {
    const schemaStr = JSON.stringify(state.formSchema, null, 2);
    const blob = new Blob([schemaStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'form-schema.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // 导入按钮
  document.getElementById('importBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
  });

  // 文件导入
  document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        try {
          const importedSchema = JSON.parse(event.target.result);
          importSchema(importedSchema);
        } catch (error) {
          alert('导入失败：JSON 格式错误');
        }
      };
      reader.readAsText(file);
    }
  });

  // 代码模式
  document.getElementById('codeBtn').addEventListener('click', function() {
    const editor = document.getElementById('codeEditor');
    const textarea = document.getElementById('schemaEditor');
    editor.classList.add('active');
    textarea.value = JSON.stringify(state.formSchema, null, 2);
  });

  // 关闭代码编辑器
  document.getElementById('closeCodeBtn').addEventListener('click', function() {
    document.getElementById('codeEditor').classList.remove('active');
  });

  // 应用代码
  document.getElementById('applyCodeBtn').addEventListener('click', function() {
    try {
      const newSchema = JSON.parse(document.getElementById('schemaEditor').value);
      importSchema(newSchema);
      document.getElementById('codeEditor').classList.remove('active');
    } catch (error) {
      alert('JSON 格式错误：' + error.message);
    }
  });

  // 预览按钮
  document.getElementById('previewBtn').addEventListener('click', function() {
    openPreview();
  });

  // 关闭预览
  document.getElementById('closePreviewBtn').addEventListener('click', function() {
    document.getElementById('previewModal').style.display = 'none';
  });
}

// 导入 Schema
function importSchema(schema) {
  state.formSchema = schema;
  state.components = [];
  state.selectedItem = null;

  // 转换 Schema 到组件数据
  const properties = schema.schema.properties || {};
  let index = 0;

  for (const [key, prop] of Object.entries(properties)) {
    const componentType = prop["x-component"];
    if (componentType && componentConfigs[componentType]) {
      const component = {
        id: 'imported_' + index,
        type: componentType,
        config: {
          name: prop.name || prop.title,
          title: prop.title || '',
          type: prop.type || 'string',
          required: prop.required || false,
          defaultValue: prop.default || '',
          placeholder: prop["x-component-props"]?.placeholder || '',
          options: prop["x-component-props"]?.options?.map(o => o.label) || [],
          content: prop["x-component-props"]?.content || '',
          showTitle: !!prop["x-component-props"]?.title,
          columns: prop["x-component-props"]?.columns || 3
        },
        position: index,
        children: [] // 初始化容器组件的子组件数组
      };
      
      // 处理容器组件的子组件
      if ((componentType === 'Card' || componentType === 'Grid') && prop.properties) {
        let childIndex = 0;
        for (const [childKey, childProp] of Object.entries(prop.properties)) {
          const childComponentType = childProp["x-component"];
          if (childComponentType && componentConfigs[childComponentType]) {
            const childComponent = {
              id: 'imported_child_' + childIndex,
              type: childComponentType,
              config: {
                name: childProp.name || childProp.title,
                title: childProp.title || '',
                type: childProp.type || 'string',
                required: childProp.required || false,
                defaultValue: childProp.default || '',
                placeholder: childProp["x-component-props"]?.placeholder || '',
                options: childProp["x-component-props"]?.options?.map(o => o.label) || []
              },
              position: childIndex
            };
            component.children.push(childComponent);
            childIndex++;
          }
        }
      }
      
      state.components.push(component);
      index++;
    }
  }

  renderFormItems();
  renderProperties();
  renderComponentTree(); // 更新组件树
}

// 打开预览
function openPreview() {
  updateSchema();

  const previewContainer = document.getElementById('previewContainer');
  const schema = state.formSchema;

  // 使用 Formily 渲染表单
  const { createForm } = Formily.Core;
  const { FormProvider, Field } = Formily.React;
  const { Form, FormItem, Input, InputNumber, Select, DatePicker, TimePicker, Switch, Slider, Radio } = Formily.Antd;

  // 创建表单实例
  const form = createForm();

  // 创建 React 组件
  const FormPreview = () => React.createElement(FormProvider, { form },
          React.createElement(Form, {
                    labelCol: schema.form?.labelCol || { span: 4 },
                    wrapperCol: schema.form?.wrapperCol || { span: 18 },
                    layout: 'horizontal'
                  },
                  Object.entries(schema.schema.properties || {}).map(([key, prop]) => {
                    let component;
                    switch(prop["x-component"]) {
                      case 'Input':
                        component = Input;
                        break;
                      case 'Textarea':
                        component = Input.TextArea;
                        break;
                      case 'InputNumber':
                        component = InputNumber;
                        break;
                      case 'Select':
                        component = Select;
                        break;
                      case 'DatePicker':
                        component = DatePicker;
                        break;
                      case 'TimePicker':
                        component = TimePicker;
                        break;
                      case 'Switch':
                        component = Switch;
                        break;
                      case 'Slider':
                        component = Slider;
                        break;
                      case 'Radio':
                        component = Radio.Group;
                        break;
                      case 'Checkbox':
                        component = null; // 暂时不支持预览
                        break;
                      default:
                        return null;
                    }

                    return React.createElement(Field, {
                      key: key,
                      name: prop.name,
                      title: prop.title,
                      component: component,
                      required: prop.required,
                      props: prop["x-component-props"] || {}
                    });
                  })
          )
  );

  // 渲染预览
  ReactDOM.render(React.createElement(FormPreview), previewContainer);
}

// 暴露函数到全局
window.editComponent = editComponent;
window.deleteComponent = deleteComponent;
window.deleteChildComponent = deleteChildComponent;
window.updateProperty = updateProperty;
window.startDrag = function(e, id) {
  // 简单的拖拽重新排序实现
  e.stopPropagation();
  const component = state.components.find(c => c.id === id);
  if (!component) return;

  const dragStart = e.clientY;
  const originalIndex = component.position;

  document.onmousemove = function(moveEvent) {
    const delta = moveEvent.clientY - dragStart;
    const newIndex = Math.max(0, Math.min(state.components.length - 1,
            originalIndex + Math.round(delta / 50)));

    if (newIndex !== component.position) {
      const otherComp = state.components.find(c => c.position === newIndex);
      if (otherComp) {
        otherComp.position = component.position;
      }
      component.position = newIndex;

      state.components.sort((a, b) => a.position - b.position);
      renderFormItems();
      renderComponentTree(); // 更新组件树
      updateSchema();
    }
  };

  document.onmouseup = function() {
    document.onmousemove = null;
    document.onmouseup = null;
  };
};