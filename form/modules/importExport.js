// Initialize event listeners
function initEventListeners() {
  // Export button
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

  // Import button
  document.getElementById('importBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
  });

  // File import
  document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        try {
          const importedSchema = JSON.parse(event.target.result);
          importSchema(importedSchema);
        } catch (error) {
          alert('Import failed: JSON format error');
        }
      };
      reader.readAsText(file);
    }
  });

  // Code mode
  document.getElementById('codeBtn').addEventListener('click', function() {
    const editor = document.getElementById('codeEditor');
    const textarea = document.getElementById('schemaEditor');
    editor.classList.add('active');
    textarea.value = JSON.stringify(state.formSchema, null, 2);
  });

  // Close code editor
  document.getElementById('closeCodeBtn').addEventListener('click', function() {
    document.getElementById('codeEditor').classList.remove('active');
  });

  // Apply code
  document.getElementById('applyCodeBtn').addEventListener('click', function() {
    try {
      const newSchema = JSON.parse(document.getElementById('schemaEditor').value);
      importSchema(newSchema);
      document.getElementById('codeEditor').classList.remove('active');
    } catch (error) {
      alert('JSON format error: ' + error.message);
    }
  });

  // Preview button
  document.getElementById('previewBtn').addEventListener('click', function() {
    openPreview();
  });

  // Close preview
  document.getElementById('closePreviewBtn').addEventListener('click', function() {
    document.getElementById('previewModal').style.display = 'none';
  });
}

// Import Schema
function importSchema(schema) {
  state.formSchema = schema;
  state.components = [];
  state.selectedItem = null;

  // Convert Schema to component data
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
        children: [] // Initialize container component's child array
      };
      
      // Handle container component's child components
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
  renderComponentTree(); // Update component tree
}

// Open preview
function openPreview() {
  updateSchema();

  const previewContainer = document.getElementById('previewContainer');
  const schema = state.formSchema;

  // Use Formily to render form
  const { createForm } = Formily.Core;
  const { FormProvider, Field } = Formily.React;
  const { Form, FormItem, Input, InputNumber, Select, DatePicker, TimePicker, Switch, Slider, Radio } = Formily.Antd;

  // Create form instance
  const form = createForm();

  // Create React component
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
                        component = null; // Preview not supported for now
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

  // Render preview
  ReactDOM.render(React.createElement(FormPreview), previewContainer);
}