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
  const components = state.components;

  // 使用与主画布相同的渲染方式来保证一致性
  let previewHTML = '';
  
  if (components.length === 0) {
    previewHTML = '<div style="text-align: center; color: #999; padding: 40px;">表单为空，请添加组件</div>';
  } else {
    // 为预览创建一个临时状态对象，去除编辑相关的UI元素
    const previewState = JSON.parse(JSON.stringify(state));
    previewState.selectedItem = null;
    
    previewHTML = components.map(comp => `
      <div class="form-item" data-id="${comp.id}" style="margin-bottom: 15px;">
        <span class="form-item-label" style="display: block; margin-bottom: 5px; font-weight: bold;">
          ${comp.config.title}${comp.config.required ? ' *' : ''}
        </span>
        <div class="form-item-content">
          ${renderComponentPreview(comp, true)}
        </div>
      </div>
    `).join('');
  }
  
  // 包装在一个简单的表单容器中
  const formHTML = `
    <form id="previewForm" style="max-width: 600px; margin: 0 auto; padding: 20px;">
      ${previewHTML}
      ${components.length > 0 ? `
        <div style="margin-top: 20px; text-align: center;">
          <button type="submit" style=" 
            background-color: #1890ff; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 4px; 
            cursor: pointer;
          ">提交</button>
        </div>
      ` : ''}
    </form>
  `;
  
  previewContainer.innerHTML = formHTML;
  
  // 添加表单提交事件处理
  const previewForm = document.getElementById('previewForm');
  if (previewForm) {
    previewForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 收集表单数据
      const formData = {};
      const formElements = previewForm.querySelectorAll('input, select, textarea, [type="hidden"]');
      
      formElements.forEach(element => {
        // 跳过没有name属性的元素
        if (!element.name) return;
        
        const name = element.name;
        const type = element.type;
        
        // 处理名称末尾的[]符号（用于多选checkbox）
        const isArray = name.endsWith('[]');
        const cleanName = isArray ? name.slice(0, -2) : name;
        
        switch(type) {
          case 'checkbox':
            if (isArray) {
              // 多选复选框
              if (!formData[cleanName]) {
                formData[cleanName] = [];
              }
              if (element.checked) {
                formData[cleanName].push(element.value);
              }
            } else {
              // 单个复选框，存储true/false
              formData[cleanName] = element.checked;
            }
            break;
          case 'radio':
            // 只保存选中的值
            if (element.checked) {
              formData[cleanName] = element.value;
            } else if (!(cleanName in formData)) {
              // 如果还没有设置该字段，则初始化为undefined
              formData[cleanName] = undefined;
            }
            break;
          case 'hidden':
            // 隐藏字段直接获取值
            formData[cleanName] = element.value;
            break;
          default:
            // 其他类型的输入框
            formData[cleanName] = element.value;
            break;
        }
      });
      
      // 显示JSON结果
      showResultModal(JSON.stringify(formData, null, 2));
      console.log('表单数据:', formData);
    });
  }
  
  // 显示预览模态框
  document.getElementById('previewModal').style.display = 'flex';
}

// 显示结果模态框
function showResultModal(jsonResult) {
  const resultModal = document.getElementById('resultModal');
  const resultContent = document.getElementById('resultContent');
  const copyStatus = document.getElementById('copyStatus');
  
  resultContent.value = jsonResult;
  resultModal.style.display = 'flex';
  copyStatus.style.display = 'none';
  
  // 绑定关闭事件
  document.getElementById('closeResultBtn').onclick = function() {
    resultModal.style.display = 'none';
  };
  
  // 绑定复制事件
  document.getElementById('copyResultBtn').onclick = function() {
    resultContent.select();
    document.execCommand('copy');
    copyStatus.style.display = 'inline';
    
    // 3秒后隐藏提示
    setTimeout(() => {
      copyStatus.style.display = 'none';
    }, 3000);
  };
}
