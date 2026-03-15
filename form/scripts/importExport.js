function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneSchema(schema) {
  return JSON.parse(JSON.stringify(schema));
}

function normalizeChoiceOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map(option => {
    if (option === null || option === undefined) {
      return '';
    }

    if (typeof option === 'object') {
      if (option.label !== undefined && option.label !== null) {
        return String(option.label);
      }
      if (option.value !== undefined && option.value !== null) {
        return String(option.value);
      }
      return '';
    }

    return String(option);
  }).filter(Boolean);
}

function normalizeCollapsePanels(panels) {
  const fallbackPanels = cloneSchema(componentConfigs.Collapse.panels);

  if (!Array.isArray(panels) || panels.length === 0) {
    return fallbackPanels;
  }

  return panels.map((panel, index) => ({
    key: panel && panel.key !== undefined ? String(panel.key) : `panel${index + 1}`,
    title: panel && panel.title !== undefined ? String(panel.title) : `Panel ${index + 1}`,
    content: panel && panel.content !== undefined ? String(panel.content) : ''
  }));
}

function normalizeImportedSchema(schema) {
  if (!isPlainObject(schema)) {
    throw new Error('Schema must be a JSON object.');
  }

  const normalizedSchema = cloneSchema(schema);

  if (normalizedSchema.form !== undefined && !isPlainObject(normalizedSchema.form)) {
    throw new Error('The "form" section must be an object.');
  }

  if (!isPlainObject(normalizedSchema.schema)) {
    throw new Error('Schema must contain a "schema" object.');
  }

  if (normalizedSchema.schema.properties === undefined) {
    normalizedSchema.schema.properties = {};
  }

  if (!isPlainObject(normalizedSchema.schema.properties)) {
    throw new Error('Schema "properties" must be an object.');
  }

  normalizedSchema.form = normalizedSchema.form || {
    labelCol: 4,
    wrapperCol: 18
  };

  return normalizedSchema;
}

function buildImportedComponent(prop, position, createImportedId, parentType = null, parentColumns = 0) {
  if (!isPlainObject(prop)) {
    return null;
  }

  const componentType = prop["x-component"];
  if (!componentType || !componentConfigs[componentType]) {
    return null;
  }

  const defaults = cloneSchema(componentConfigs[componentType]);
  const componentProps = isPlainObject(prop["x-component-props"]) ? prop["x-component-props"] : {};
  const rawPosition = Number.isInteger(prop["x-position"]) ? prop["x-position"] : position;
  const component = {
    id: createImportedId(),
    type: componentType,
    config: {
      ...defaults,
      name: prop.name ? String(prop.name) : defaults.name,
      title: prop.title !== undefined ? String(prop.title) : defaults.title,
      type: typeof prop.type === 'string' ? prop.type : defaults.type,
      required: !!prop.required,
      defaultValue: prop.default !== undefined ? prop.default : defaults.defaultValue,
      placeholder: componentProps.placeholder !== undefined ? String(componentProps.placeholder) : defaults.placeholder,
      options: componentType === 'Cascader'
        ? (Array.isArray(componentProps.options) ? componentProps.options : defaults.options)
        : normalizeChoiceOptions(componentProps.options !== undefined ? componentProps.options : defaults.options),
      content: componentProps.content !== undefined ? String(componentProps.content) : defaults.content,
      showTitle: componentProps.title !== undefined ? true : !!defaults.showTitle,
      columns: Number.isInteger(componentProps.columns) ? componentProps.columns : defaults.columns,
      direction: componentProps.direction === 'horizontal' ? 'horizontal' : defaults.direction,
      panels: componentType === 'Collapse' ? normalizeCollapsePanels(componentProps.panels) : defaults.panels
    },
    position: rawPosition,
    children: isContainerComponent(componentType) ? [] : undefined
  };

  if (parentType === 'Grid') {
    const safeColumns = Math.max(1, parentColumns || 1);
    component.position = Number.isInteger(rawPosition)
      ? Math.max(0, Math.min(safeColumns - 1, rawPosition))
      : Math.min(position, safeColumns - 1);
  }

  if ((componentType === 'Card' || componentType === 'Grid') && isPlainObject(prop.properties)) {
    let childIndex = 0;
    Object.values(prop.properties).forEach(childProp => {
      const childComponent = buildImportedComponent(
        childProp,
        childIndex,
        createImportedId,
        componentType,
        component.config.columns || 3
      );

      if (childComponent) {
        component.children.push(childComponent);
        childIndex += 1;
      }
    });
  }

  return component;
}

// Initialize event listeners
function initEventListeners() {
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

  document.getElementById('importBtn').addEventListener('click', function() {
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const importedSchema = JSON.parse(event.target.result);
        importSchema(importedSchema);
      } catch (error) {
        alert('Import failed: ' + error.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('codeBtn').addEventListener('click', function() {
    const editor = document.getElementById('codeEditor');
    const textarea = document.getElementById('schemaEditor');
    editor.classList.add('active');
    textarea.value = JSON.stringify(state.formSchema, null, 2);
  });

  document.getElementById('closeCodeBtn').addEventListener('click', function() {
    document.getElementById('codeEditor').classList.remove('active');
  });

  document.getElementById('applyCodeBtn').addEventListener('click', function() {
    try {
      const newSchema = JSON.parse(document.getElementById('schemaEditor').value);
      importSchema(newSchema);
      document.getElementById('codeEditor').classList.remove('active');
    } catch (error) {
      alert('Apply failed: ' + error.message);
    }
  });

  document.getElementById('previewBtn').addEventListener('click', function() {
    openPreview();
  });

  document.getElementById('closePreviewBtn').addEventListener('click', function() {
    document.getElementById('previewModal').style.display = 'none';
  });
}

// Import Schema
function importSchema(schema) {
  const normalizedSchema = normalizeImportedSchema(schema);
  const createImportedId = (() => {
    let counter = 0;
    return function() {
      return 'imported_' + counter++;
    };
  })();
  const components = [];

  Object.values(normalizedSchema.schema.properties).forEach((prop, index) => {
    const component = buildImportedComponent(prop, index, createImportedId);
    if (component) {
      component.position = index;
      components.push(component);
    }
  });

  state.formSchema = normalizedSchema;
  state.components = components;
  state.selectedItem = null;
  state.nextId = 1;

  updateSchema();
  renderFormItems();
  renderProperties();
  renderComponentTree();
}

// Open preview
function openPreview() {
  updateSchema();

  const previewContainer = document.getElementById('previewContainer');
  const components = state.components;

  let previewHTML = '';

  if (components.length === 0) {
    previewHTML = '<div style="text-align: center; color: #999; padding: 40px;">Form is empty, please add components first</div>';
  } else {
    previewHTML = components.map(comp => `
      <div class="form-item" data-id="${comp.id}" style="margin-bottom: 15px;">
        <span class="form-item-label" style="display: block; margin-bottom: 5px; font-weight: bold;">
          ${escapeHTML(comp.config.title)}${comp.config.required ? ' *' : ''}
        </span>
        <div class="form-item-content">
          ${renderComponentPreview(comp, true)}
        </div>
      </div>
    `).join('');
  }

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
          ">Submit</button>
        </div>
      ` : ''}
    </form>
  `;

  previewContainer.innerHTML = formHTML;

  const previewForm = document.getElementById('previewForm');
  if (previewForm) {
    previewForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const formData = {};
      const formElements = previewForm.querySelectorAll('input, select, textarea');

      formElements.forEach(element => {
        if (!element.name) return;

        const name = element.name;
        const type = element.type;
        const isArray = name.endsWith('[]');
        const cleanName = isArray ? name.slice(0, -2) : name;

        switch (type) {
          case 'checkbox':
            if (isArray) {
              if (!formData[cleanName]) {
                formData[cleanName] = [];
              }
              if (element.checked) {
                formData[cleanName].push(element.value);
              }
            } else {
              formData[cleanName] = element.checked;
            }
            break;
          case 'radio':
            if (element.checked) {
              formData[cleanName] = element.value;
            } else if (!(cleanName in formData)) {
              formData[cleanName] = undefined;
            }
            break;
          case 'hidden':
            formData[cleanName] = element.value;
            break;
          default:
            formData[cleanName] = element.value;
            break;
        }
      });

      showResultModal(JSON.stringify(formData, null, 2));
      console.log('Form data:', formData);
    });
  }

  document.getElementById('previewModal').style.display = 'flex';
}

// Show result modal
function showResultModal(jsonResult) {
  const resultModal = document.getElementById('resultModal');
  const resultContent = document.getElementById('resultContent');
  const copyStatus = document.getElementById('copyStatus');

  resultContent.value = jsonResult;
  resultModal.style.display = 'flex';
  copyStatus.style.display = 'none';

  document.getElementById('closeResultBtn').onclick = function() {
    resultModal.style.display = 'none';
  };

  document.getElementById('copyResultBtn').onclick = function() {
    resultContent.select();
    document.execCommand('copy');
    copyStatus.style.display = 'inline';

    setTimeout(() => {
      copyStatus.style.display = 'none';
    }, 3000);
  };
}
