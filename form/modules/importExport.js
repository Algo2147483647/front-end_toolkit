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

  // 直接渲染表单而不需要依赖 Formily 库
  const renderFormField = (key, prop) => {
    const fieldName = prop.name || key;
    const fieldTitle = prop.title || '';
    const fieldPlaceholder = prop["x-component-props"]?.placeholder || '';
    const isRequired = prop.required || false;
    
    const label = React.createElement('label', { 
      htmlFor: fieldName,
      style: { display: 'block', marginBottom: '5px', fontWeight: 'bold' }
    }, fieldTitle + (isRequired ? ' *' : ''));
    
    let inputElement;
    
    switch(prop["x-component"]) {
      case 'Input':
        inputElement = React.createElement('input', {
          type: 'text',
          id: fieldName,
          name: fieldName,
          placeholder: fieldPlaceholder,
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }
        });
        break;
        
      case 'Textarea':
        inputElement = React.createElement('textarea', {
          id: fieldName,
          name: fieldName,
          placeholder: fieldPlaceholder,
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px', minHeight: '80px' }
        });
        break;
        
      case 'InputNumber':
        inputElement = React.createElement('input', {
          type: 'number',
          id: fieldName,
          name: fieldName,
          placeholder: fieldPlaceholder,
          defaultValue: prop.default || '',
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }
        });
        break;
        
      case 'Select':
        const options = prop["x-component-props"]?.options || [];
        const optionElements = options.map((opt, idx) => 
          React.createElement('option', { key: idx, value: opt.value || opt.label || opt }, opt.label || opt)
        );
        inputElement = React.createElement('select', {
          id: fieldName,
          name: fieldName,
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }
        }, ...optionElements);
        break;
        
      case 'DatePicker':
        inputElement = React.createElement('input', {
          type: 'date',
          id: fieldName,
          name: fieldName,
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }
        });
        break;
        
      case 'TimePicker':
        inputElement = React.createElement('input', {
          type: 'time',
          id: fieldName,
          name: fieldName,
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }
        });
        break;
        
      case 'Switch':
        inputElement = React.createElement('div', { style: { display: 'flex', alignItems: 'center' } },
          React.createElement('input', {
            type: 'checkbox',
            id: fieldName,
            name: fieldName,
            defaultChecked: prop.default || false
          }),
          React.createElement('label', { 
            htmlFor: fieldName,
            style: { marginLeft: '8px' }
          }, 'ON')
        );
        break;
        
      case 'Slider':
        inputElement = React.createElement('div', { style: { display: 'flex', alignItems: 'center' } },
          React.createElement('input', {
            type: 'range',
            id: fieldName,
            name: fieldName,
            min: prop["x-component-props"]?.min || 0,
            max: prop["x-component-props"]?.max || 100,
            defaultValue: prop.default || 0,
            style: { flexGrow: 1 }
          }),
          React.createElement('span', { 
            style: { marginLeft: '10px' } 
          }, prop.default || 0)
        );
        break;
        
      case 'Radio':
        const radioOptions = prop["x-component-props"]?.options || ['Option 1', 'Option 2'];
        const radioElements = radioOptions.map((opt, idx) => 
          React.createElement('div', { key: idx, style: { display: 'flex', alignItems: 'center', marginBottom: '5px' } },
            React.createElement('input', {
              type: 'radio',
              id: `${fieldName}_${idx}`,
              name: fieldName,
              value: opt.value || opt.label || opt,
              defaultChecked: idx === 0
            }),
            React.createElement('label', { 
              htmlFor: `${fieldName}_${idx}`,
              style: { marginLeft: '5px' }
            }, opt.label || opt)
          )
        );
        inputElement = React.createElement('div', null, ...radioElements);
        break;
        
      case 'Checkbox':
        const checkboxOptions = prop["x-component-props"]?.options || ['Option 1', 'Option 2', 'Option 3'];
        const checkboxElements = checkboxOptions.map((opt, idx) => 
          React.createElement('div', { key: idx, style: { display: 'flex', alignItems: 'center', marginBottom: '5px' } },
            React.createElement('input', {
              type: 'checkbox',
              id: `${fieldName}_${idx}`,
              name: fieldName,
              value: opt.value || opt.label || opt
            }),
            React.createElement('label', { 
              htmlFor: `${fieldName}_${idx}`,
              style: { marginLeft: '5px' }
            }, opt.label || opt)
          )
        );
        inputElement = React.createElement('div', null, ...checkboxElements);
        break;
        
      default:
        inputElement = React.createElement('input', {
          type: 'text',
          id: fieldName,
          name: fieldName,
          placeholder: 'Unsupported component: ' + prop["x-component"],
          style: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }
        });
    }
    
    return React.createElement('div', { 
      className: 'form-field',
      style: { marginBottom: '15px' }
    }, label, inputElement);
  };

  // 创建表单元素
  const formFields = Object.entries(schema.schema.properties || {}).map(([key, prop]) => 
    renderFormField(key, prop)
  );

  const formElement = React.createElement('form', {
    onSubmit: (e) => {
      e.preventDefault();
      alert('表单提交功能仅在预览模式下展示');
    },
    style: { maxWidth: '600px', margin: '0 auto', padding: '20px' }
  }, ...formFields, 
     React.createElement('button', { 
       type: 'submit',
       style: { 
         backgroundColor: '#1890ff', 
         color: 'white', 
         border: 'none', 
         padding: '10px 20px', 
         borderRadius: '4px', 
         cursor: 'pointer' 
       }
     }, '提交')
  );

  // 渲染表单
  ReactDOM.render(formElement, previewContainer);
  
  // 显示预览模态框
  document.getElementById('previewModal').style.display = 'flex';
}
