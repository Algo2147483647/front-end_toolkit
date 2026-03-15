const INSPECTOR_TABS = [
  { id: 'content', label: 'Content' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'style', label: 'Style' },
  { id: 'advanced', label: 'Advanced' }
];

const inspectorState = {
  activeTab: 'content',
  fieldMap: {},
  notice: null,
  lastComponentId: null
};

function section(title, description, fields) {
  return {
    title,
    description,
    fields: fields.filter(Boolean)
  };
}

function configField(key, label, editor, options = {}) {
  return {
    key,
    label,
    editor,
    getValue(component) {
      return component.config[key];
    },
    setValue(component, value) {
      component.config[key] = value;
    },
    ...options
  };
}

function readonlyField(key, label, getValue, options = {}) {
  return {
    key,
    label,
    editor: 'readonly',
    getValue,
    ...options
  };
}

function jsonConfigField(key, label, options = {}) {
  return configField(key, label, 'json', {
    rows: options.rows || 8,
    parse(rawValue) {
      return parseJSONValue(rawValue, options.arrayOnly ? 'array' : 'any', label);
    },
    format(value) {
      return JSON.stringify(value ?? (options.arrayOnly ? [] : {}), null, 2);
    },
    ...options
  });
}

function listConfigField(key, label, options = {}) {
  return configField(key, label, 'list', {
    rows: options.rows || 5,
    parse(rawValue) {
      return rawValue
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
    },
    format(value) {
      return Array.isArray(value) ? value.join('\n') : '';
    },
    ...options
  });
}

function optionsConfigField(key, label, options = {}) {
  return configField(key, label, 'optionsTable', {
    getValue(component) {
      return normalizeChoiceOptions(component.config[key] || []);
    },
    setValue(component, value) {
      component.config[key] = normalizeChoiceOptions(value);
    },
    ...options
  });
}

function collapsePanelsField(key, label, options = {}) {
  return configField(key, label, 'collapsePanels', {
    getValue(component) {
      return Array.isArray(component.config[key]) ? component.config[key] : [];
    },
    setValue(component, value) {
      component.config[key] = value;
    },
    ...options
  });
}

function columnPresetField(key, label, options = {}) {
  return configField(key, label, 'columnPreset', {
    min: 1,
    max: 12,
    presets: [1, 2, 3, 4, 6],
    ...options
  });
}

function buildSharedInspectorTabs(component) {
  const tabs = {
    content: [
      section('Basics', 'Core identity fields for this component.', [
        readonlyField('componentType', 'Component Type', comp => comp.type, {
          description: 'The current renderer mapped to this schema node.'
        }),
        configField('name', 'Field Name', 'text', {
          description: 'Stable field key used for submission payloads.'
        }),
        configField('title', 'Display Title', 'text', {
          description: 'Primary label shown in the canvas and preview.'
        }),
        configField('description', 'Helper Text', 'textarea', {
          rows: 3,
          description: 'Optional supporting copy shown below the control in preview.'
        })
      ])
    ],
    behavior: [
      section('Availability', 'Control visibility and interaction state.', [
        configField('hidden', 'Always Hidden', 'toggle', {
          description: 'Hide this field in preview regardless of other rules.'
        }),
        configField('disabled', 'Disabled', 'toggle', {
          description: 'Keep the field visible but block editing.'
        }),
        configField('readOnly', 'Read Only', 'toggle', {
          description: 'Show the value while preventing changes on text-like controls.'
        })
      ]),
      section('Visibility Rule', 'Set a simple display condition based on another field.', [
        configField('visibilityMode', 'Mode', 'select', {
          options: [
            { label: 'Always visible', value: 'always' },
            { label: 'Visible on match', value: 'conditional' }
          ]
        }),
        configField('visibilityField', 'Depends On Field', 'text', {
          showWhen(comp) {
            return comp.config.visibilityMode === 'conditional';
          },
          description: 'Reference the target field name, for example `status`.'
        }),
        configField('visibilityValue', 'Expected Value', 'text', {
          showWhen(comp) {
            return comp.config.visibilityMode === 'conditional';
          },
          description: 'When the target field equals this value, the field appears.'
        })
      ])
    ],
    style: [],
    advanced: [
      section('Schema Meta', 'Low-level values useful when debugging schema output.', [
        readonlyField('componentId', 'Component ID', comp => comp.id),
        readonlyField('schemaType', 'Schema Type', comp => comp.config.type || 'void')
      ]),
      section('Raw Config', 'Edit the full config object for this component as JSON.', [
        {
          key: 'rawConfig',
          label: 'Config JSON',
          editor: 'json',
          rows: 10,
          description: 'Useful for advanced tweaks before they get a dedicated UI control.',
          getValue(comp) {
            return JSON.stringify(comp.config, null, 2);
          },
          setValue(comp, value) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
              throw new Error('Config JSON must be a plain object.');
            }
            comp.config = {
              ...componentConfigs[comp.type],
              ...comp.config,
              ...value
            };
            if (supportsChoiceOptions(comp.type)) {
              comp.config.options = normalizeChoiceOptions(comp.config.options);
            }
          },
          parse(rawValue) {
            return parseJSONValue(rawValue, 'object', 'Config JSON');
          }
        }
      ])
    ]
  };

  if (supportsRequired(component.type)) {
    tabs.behavior.push(
      section('Validation', 'Control whether users must complete this field.', [
        configField('required', 'Required', 'toggle', {
          description: 'Adds required validation to the exported schema.'
        })
      ])
    );
  }

  if (supportsTitleToggle(component.type)) {
    tabs.style.push(
      section('Container Chrome', 'Adjust how the container label is presented.', [
        configField('showTitle', 'Show Title', 'toggle', {
          description: 'Show the container title treatment in the canvas.'
        })
      ])
    );
  }

  return tabs;
}

const inspectorRegistry = {
  Input(component) {
    return {
      content: [
        section('Input Copy', 'Field-level copy shown inside the control.', [
          configField('placeholder', 'Placeholder', 'text', {
            description: 'Inline guidance shown before the user types.'
          })
        ])
      ],
      behavior: [
        section('Value', 'Default state used when the preview opens.', [
          configField('defaultValue', 'Default Value', 'text')
        ])
      ]
    };
  },
  Textarea(component) {
    return {
      content: [
        section('Input Copy', 'Field-level copy shown inside the control.', [
          configField('placeholder', 'Placeholder', 'text', {
            description: 'Inline guidance shown before the user types.'
          })
        ])
      ],
      behavior: [
        section('Value', 'Default state used when the preview opens.', [
          configField('defaultValue', 'Default Value', 'textarea', {
            rows: 4
          })
        ])
      ]
    };
  },
  InputNumber(component) {
    return {
      behavior: [
        section('Number State', 'Basic numeric defaults for the field preview.', [
          configField('defaultValue', 'Default Value', 'number'),
          configField('min', 'Minimum', 'number', {
            description: 'Stored for future numeric rule support.'
          }),
          configField('max', 'Maximum', 'number', {
            description: 'Stored for future numeric rule support.'
          })
        ])
      ]
    };
  },
  Select(component) {
    return {
      content: [
        section('Choice Source', 'Manage dropdown choices as label and value pairs.', [
          optionsConfigField('options', 'Options', {
            description: 'Each row controls the visible label and submitted value.'
          })
        ])
      ],
      behavior: [
        section('Selection State', 'Choose which option is initially selected.', [
          configField('defaultValue', 'Default Value', 'text')
        ])
      ]
    };
  },
  Radio(component) {
    return {
      content: [
        section('Choice Source', 'Manage radio choices as label and value pairs.', [
          optionsConfigField('options', 'Options', {
            description: 'Each row controls the visible label and submitted value.'
          })
        ])
      ],
      behavior: [
        section('Selection State', 'Choose which option is initially selected.', [
          configField('defaultValue', 'Default Value', 'text')
        ])
      ]
    };
  },
  Checkbox(component) {
    return {
      content: [
        section('Choice Source', 'Manage checkbox choices as label and value pairs.', [
          optionsConfigField('options', 'Options', {
            description: 'Each row controls the visible label and submitted value.'
          })
        ])
      ],
      behavior: [
        section('Selection State', 'Default selections used in preview.', [
          listConfigField('defaultValue', 'Default Values', {
            description: 'One selected value per line.'
          })
        ])
      ]
    };
  },
  Cascader(component) {
    return {
      content: [
        section('Nested Options', 'Edit the cascader tree in raw JSON.', [
          jsonConfigField('options', 'Options JSON', {
            arrayOnly: true,
            rows: 10,
            description: 'Provide an array of label/value nodes with optional children.'
          })
        ])
      ],
      behavior: [
        section('Selection State', 'Store a default path for the preview.', [
          jsonConfigField('defaultValue', 'Default Path JSON', {
            arrayOnly: true,
            rows: 4,
            description: 'Usually an array representing the selected path.'
          })
        ])
      ]
    };
  },
  DatePicker(component) {
    return {
      behavior: [
        section('Date State', 'Initial date shown in preview.', [
          configField('defaultValue', 'Default Value', 'text', {
            description: 'Use a browser-friendly date string such as 2026-03-15.'
          })
        ])
      ]
    };
  },
  TimePicker(component) {
    return {
      behavior: [
        section('Time State', 'Initial time shown in preview.', [
          configField('defaultValue', 'Default Value', 'text', {
            description: 'Use a browser-friendly time string such as 09:30.'
          })
        ])
      ]
    };
  },
  Switch(component) {
    return {
      behavior: [
        section('Toggle State', 'Define whether the switch starts enabled.', [
          configField('defaultValue', 'Default Value', 'toggle')
        ])
      ]
    };
  },
  Slider(component) {
    return {
      behavior: [
        section('Range', 'Core range settings for the slider control.', [
          configField('min', 'Minimum', 'number'),
          configField('max', 'Maximum', 'number'),
          configField('defaultValue', 'Default Value', 'number')
        ])
      ]
    };
  },
  ColorPicker(component) {
    return {
      content: [
        section('Color Value', 'Set the starting color token.', [
          configField('defaultValue', 'Default Color', 'color')
        ])
      ]
    };
  },
  Card(component) {
    return {};
  },
  Divider(component) {
    return {
      content: [
        section('Divider Copy', 'Text rendered on the divider line.', [
          configField('content', 'Divider Text', 'text')
        ])
      ]
    };
  },
  Grid(component) {
    return {
      style: [
        section('Layout', 'Structural controls for the grid container.', [
          columnPresetField('columns', 'Columns', {
            description: 'The number of visible columns in the grid.',
            min: 1,
            max: 12
          })
        ])
      ]
    };
  },
  Collapse(component) {
    return {
      content: [
        section('Panels', 'Manage panel titles and content with structured rows.', [
          collapsePanelsField('panels', 'Panels', {
            description: 'Add, edit, and remove collapsible sections without raw JSON.'
          })
        ])
      ],
      style: [
        section('Presentation', 'Switch how panels are presented in the canvas.', [
          configField('direction', 'Direction', 'select', {
            options: [
              { label: 'Vertical', value: 'vertical' },
              { label: 'Horizontal Tabs', value: 'horizontal' }
            ]
          })
        ])
      ]
    };
  }
};

function supportsRequired(type) {
  return !['Card', 'Grid', 'Divider', 'Collapse'].includes(type);
}

function supportsTitleToggle(type) {
  return ['Card', 'Grid', 'Divider'].includes(type);
}

function mergeInspectorTabs(sharedTabs, specificTabs) {
  const merged = {};

  INSPECTOR_TABS.forEach(tab => {
    merged[tab.id] = [
      ...(sharedTabs[tab.id] || []),
      ...(specificTabs[tab.id] || [])
    ].filter(sectionConfig => sectionConfig.fields.length > 0);
  });

  return merged;
}

function buildInspectorTabs(component) {
  const sharedTabs = buildSharedInspectorTabs(component);
  const specificTabs = inspectorRegistry[component.type]
    ? inspectorRegistry[component.type](component)
    : {};

  return mergeInspectorTabs(sharedTabs, specificTabs);
}

function parseJSONValue(rawValue, mode, label) {
  let parsedValue;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    throw new Error(label + ' must be valid JSON.');
  }

  if (mode === 'array' && !Array.isArray(parsedValue)) {
    throw new Error(label + ' must be a JSON array.');
  }

  if (mode === 'object' && (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue))) {
    throw new Error(label + ' must be a JSON object.');
  }

  return parsedValue;
}

function getFieldRuntimeId(component, fieldKey) {
  return component.id + '__' + fieldKey;
}

function getFieldValue(component, field) {
  const rawValue = field.getValue(component);
  if (field.format) {
    return field.format(rawValue, component);
  }
  return rawValue;
}

function normalizeFieldValue(field, rawValue) {
  if (field.parse) {
    return field.parse(rawValue);
  }

  switch (field.editor) {
    case 'number':
    case 'columnPreset':
      if (rawValue === '') {
        return 0;
      }
      return Number(rawValue);
    case 'toggle':
      return !!rawValue;
    default:
      return rawValue;
  }
}

function applyInspectorValue(fieldId, nextValue) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  try {
    field.setValue(state.selectedItem, nextValue);
    inspectorState.notice = null;
    syncInspectorUI();
  } catch (error) {
    inspectorState.notice = {
      tone: 'error',
      message: error.message
    };
    renderProperties();
  }
}

function renderOptionsTable(fieldId, value) {
  const options = normalizeChoiceOptions(value || []);

  return `
    <div class="inspector-collection">
      <div class="inspector-collection-head">
        <span>Label</span>
        <span>Value</span>
        <span></span>
      </div>
      ${options.map((option, index) => `
        <div class="inspector-collection-row">
          <input class="ant-input" value="${escapeAttribute(option.label)}" onchange="updateOptionsEditorField('${fieldId}', ${index}, 'label', this.value)">
          <input class="ant-input" value="${escapeAttribute(option.value)}" onchange="updateOptionsEditorField('${fieldId}', ${index}, 'value', this.value)">
          <button type="button" class="inspector-collection-action" onclick="removeOptionsEditorRow('${fieldId}', ${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join('')}
      <button type="button" class="inspector-add-button" onclick="addOptionsEditorRow('${fieldId}')">
        <i class="fas fa-plus"></i>
        Add Option
      </button>
    </div>`;
}

function renderCollapsePanelsEditor(fieldId, value) {
  const panels = Array.isArray(value) ? value : [];

  return `
    <div class="inspector-panel-editor">
      ${panels.map((panel, index) => `
        <div class="inspector-panel-card">
          <div class="inspector-panel-card-header">
            <strong>Panel ${index + 1}</strong>
            <button type="button" class="inspector-collection-action" onclick="removeCollapseEditorPanel('${fieldId}', ${index})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <input class="ant-input" value="${escapeAttribute(panel.key || `panel${index + 1}`)}" onchange="updateCollapsePanelField('${fieldId}', ${index}, 'key', this.value)" placeholder="Panel key">
          <input class="ant-input" value="${escapeAttribute(panel.title || '')}" onchange="updateCollapsePanelField('${fieldId}', ${index}, 'title', this.value)" placeholder="Panel title">
          <textarea class="ant-input" rows="4" onchange="updateCollapsePanelField('${fieldId}', ${index}, 'content', this.value)" placeholder="Panel content">${escapeHTML(panel.content || '')}</textarea>
        </div>
      `).join('')}
      <button type="button" class="inspector-add-button" onclick="addCollapseEditorPanel('${fieldId}')">
        <i class="fas fa-plus"></i>
        Add Panel
      </button>
    </div>`;
}

function renderColumnPresetEditor(fieldId, field, value) {
  const currentValue = Number(value || 1);

  return `
    <div class="inspector-column-editor">
      <div class="inspector-chip-row">
        ${(field.presets || []).map(preset => `
          <button
            type="button"
            class="inspector-chip ${preset === currentValue ? 'active' : ''}"
            onclick="applyColumnPreset('${fieldId}', ${preset})"
          >
            ${preset} Col${preset > 1 ? 's' : ''}
          </button>
        `).join('')}
      </div>
      <input
        type="number"
        class="ant-input"
        value="${escapeAttribute(currentValue)}"
        min="${field.min !== undefined ? field.min : 1}"
        max="${field.max !== undefined ? field.max : 12}"
        onchange="updateInspectorField('${fieldId}', this.value)"
      >
    </div>`;
}

function renderProperties() {
  const container = document.getElementById('propertiesContent');

  if (!state.selectedItem) {
    container.innerHTML = `
      <div class="empty-properties inspector-empty">
        <div>
          <p class="inspector-empty-title">Select a component to configure</p>
          <p class="inspector-empty-copy">The inspector will show grouped controls for content, behavior, style, and advanced schema editing.</p>
        </div>
      </div>`;
    return;
  }

  const component = state.selectedItem;
  const componentTabs = buildInspectorTabs(component);

  if (inspectorState.lastComponentId !== component.id) {
    inspectorState.lastComponentId = component.id;
    inspectorState.notice = null;
    if (!componentTabs[inspectorState.activeTab] || componentTabs[inspectorState.activeTab].length === 0) {
      inspectorState.activeTab = 'content';
    }
  }

  inspectorState.fieldMap = {};

  const activeTabSections = componentTabs[inspectorState.activeTab] || [];
  const componentLabel = component.config.title || component.type;
  const icon = getComponentIcon(component.type);

  container.innerHTML = `
    <div class="inspector-shell">
      <div class="inspector-summary">
        <div class="inspector-summary-icon">
          <i class="fas fa-${icon}"></i>
        </div>
        <div class="inspector-summary-copy">
          <span class="inspector-summary-type">${escapeHTML(component.type)}</span>
          <h3>${escapeHTML(componentLabel)}</h3>
          <p>${escapeHTML(component.config.name)}</p>
        </div>
      </div>

      <div class="inspector-tabs">
        ${INSPECTOR_TABS.map(tab => `
          <button
            type="button"
            class="inspector-tab ${inspectorState.activeTab === tab.id ? 'active' : ''}"
            onclick="switchInspectorTab('${tab.id}')"
          >
            ${tab.label}
          </button>
        `).join('')}
      </div>

      ${renderInspectorNotice()}

      <div class="inspector-sections">
        ${activeTabSections.length > 0
          ? activeTabSections.map(sectionConfig => renderInspectorSection(component, sectionConfig)).join('')
          : `
            <div class="inspector-empty-tab">
              <p class="inspector-empty-title">No controls in this tab yet</p>
              <p class="inspector-empty-copy">This layout is ready for more component-specific configuration as we expand the registry.</p>
            </div>
          `}
      </div>
    </div>`;
}

function renderInspectorNotice() {
  if (!inspectorState.notice) {
    return '';
  }

  return `
    <div class="inspector-notice ${inspectorState.notice.tone || 'error'}">
      ${escapeHTML(inspectorState.notice.message)}
    </div>`;
}

function renderInspectorSection(component, sectionConfig) {
  const visibleFields = sectionConfig.fields.filter(field => !field.showWhen || field.showWhen(component));

  return `
    <section class="inspector-section">
      <div class="inspector-section-header">
        <h4>${escapeHTML(sectionConfig.title)}</h4>
        <p>${escapeHTML(sectionConfig.description)}</p>
      </div>
      <div class="inspector-section-body">
        ${visibleFields.map(field => renderInspectorField(component, field)).join('')}
      </div>
    </section>`;
}

function renderInspectorField(component, field) {
  const fieldId = getFieldRuntimeId(component, field.key);
  inspectorState.fieldMap[fieldId] = field;

  const isVertical = ['textarea', 'json', 'list', 'optionsTable', 'collapsePanels', 'columnPreset'].includes(field.editor);
  const fieldValue = getFieldValue(component, field);
  const description = field.description
    ? `<p class="inspector-field-help">${escapeHTML(field.description)}</p>`
    : '';

  return `
    <div class="property-field ${isVertical ? 'vertical' : ''}">
      <div class="field-stack">
        <label class="property-label">${escapeHTML(field.label)}</label>
        ${description}
      </div>
      <div class="field-control">
        ${renderInspectorControl(fieldId, field, fieldValue)}
      </div>
    </div>`;
}

function renderInspectorControl(fieldId, field, value) {
  switch (field.editor) {
    case 'readonly':
      return `<div class="inspector-readonly">${escapeHTML(value ?? '')}</div>`;
    case 'text':
      return `<input class="ant-input" value="${escapeAttribute(value ?? '')}" onchange="updateInspectorField('${fieldId}', this.value)">`;
    case 'textarea':
      return `<textarea class="ant-input" rows="${field.rows || 4}" onchange="updateInspectorField('${fieldId}', this.value)">${escapeHTML(value ?? '')}</textarea>`;
    case 'number':
      return `<input type="number" class="ant-input" value="${escapeAttribute(value ?? 0)}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} onchange="updateInspectorField('${fieldId}', this.value)">`;
    case 'toggle':
      return `
        <label class="inspector-toggle">
          <input type="checkbox" ${value ? 'checked' : ''} onchange="toggleInspectorField('${fieldId}', this.checked)">
          <span>${value ? 'Enabled' : 'Disabled'}</span>
        </label>`;
    case 'select':
      return `
        <select class="ant-input" onchange="updateInspectorField('${fieldId}', this.value)">
          ${(field.options || []).map(option => `
            <option value="${escapeAttribute(option.value)}" ${option.value === value ? 'selected' : ''}>
              ${escapeHTML(option.label)}
            </option>
          `).join('')}
        </select>`;
    case 'list':
      return `<textarea class="ant-input" rows="${field.rows || 5}" onchange="updateInspectorField('${fieldId}', this.value)">${escapeHTML(value ?? '')}</textarea>`;
    case 'json':
      return `<textarea class="ant-input" rows="${field.rows || 8}" onchange="updateInspectorField('${fieldId}', this.value)">${escapeHTML(value ?? '')}</textarea>`;
    case 'optionsTable':
      return renderOptionsTable(fieldId, value);
    case 'collapsePanels':
      return renderCollapsePanelsEditor(fieldId, value);
    case 'columnPreset':
      return renderColumnPresetEditor(fieldId, field, value);
    case 'color':
      return `
        <div class="inspector-color-field">
          <input type="color" class="ant-input inspector-color-input" value="${escapeAttribute(value || '#1890ff')}" onchange="updateInspectorField('${fieldId}', this.value)">
          <input class="ant-input" value="${escapeAttribute(value || '#1890ff')}" onchange="updateInspectorField('${fieldId}', this.value)">
        </div>`;
    default:
      return `<input class="ant-input" value="${escapeAttribute(value ?? '')}" onchange="updateInspectorField('${fieldId}', this.value)">`;
  }
}

function switchInspectorTab(tabId) {
  inspectorState.activeTab = tabId;
  renderProperties();
}

function syncInspectorUI() {
  renderFormItems();
  renderProperties();
  renderComponentTree();
  updateSchema();
}

function updateInspectorField(fieldId, rawValue) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  try {
    const nextValue = normalizeFieldValue(field, rawValue);
    applyInspectorValue(fieldId, nextValue);
  } catch (error) {
    inspectorState.notice = {
      tone: 'error',
      message: error.message
    };
    renderProperties();
  }
}

function toggleInspectorField(fieldId, checked) {
  updateInspectorField(fieldId, checked);
}

function updateOptionsEditorField(fieldId, index, key, rawValue) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  const options = normalizeChoiceOptions(field.getValue(state.selectedItem) || []);
  if (!options[index]) {
    return;
  }

  options[index] = {
    ...options[index],
    [key]: rawValue
  };

  if (!options[index].value) {
    options[index].value = options[index].label;
  }

  applyInspectorValue(fieldId, options);
}

function addOptionsEditorRow(fieldId) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  const options = normalizeChoiceOptions(field.getValue(state.selectedItem) || []);
  options.push({
    label: `Option ${options.length + 1}`,
    value: `option_${options.length + 1}`
  });
  applyInspectorValue(fieldId, options);
}

function removeOptionsEditorRow(fieldId, index) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  const options = normalizeChoiceOptions(field.getValue(state.selectedItem) || []);
  options.splice(index, 1);
  applyInspectorValue(fieldId, options);
}

function updateCollapsePanelField(fieldId, index, key, rawValue) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  const panels = Array.isArray(field.getValue(state.selectedItem))
    ? field.getValue(state.selectedItem).map(panel => ({ ...panel }))
    : [];

  if (!panels[index]) {
    return;
  }

  panels[index][key] = rawValue;
  applyInspectorValue(fieldId, panels);
}

function addCollapseEditorPanel(fieldId) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  const panels = Array.isArray(field.getValue(state.selectedItem))
    ? field.getValue(state.selectedItem).map(panel => ({ ...panel }))
    : [];
  const nextIndex = panels.length + 1;

  panels.push({
    key: `panel${nextIndex}`,
    title: `Panel ${nextIndex}`,
    content: ''
  });
  applyInspectorValue(fieldId, panels);
}

function removeCollapseEditorPanel(fieldId, index) {
  const field = inspectorState.fieldMap[fieldId];
  if (!field || !state.selectedItem) {
    return;
  }

  const panels = Array.isArray(field.getValue(state.selectedItem))
    ? field.getValue(state.selectedItem).map(panel => ({ ...panel }))
    : [];

  if (panels.length <= 1) {
    inspectorState.notice = {
      tone: 'error',
      message: 'Collapse must keep at least one panel.'
    };
    renderProperties();
    return;
  }

  panels.splice(index, 1);
  applyInspectorValue(fieldId, panels);
}

function applyColumnPreset(fieldId, columns) {
  applyInspectorValue(fieldId, columns);
}

// Backward-compatible wrappers
function updateProperty(key, value) {
  if (!state.selectedItem) {
    return;
  }
  state.selectedItem.config[key] = value;
  inspectorState.notice = null;
  syncInspectorUI();
}

function updateCascaderOptions(value, id) {
  const component = findComponentById(id);
  if (!component) {
    return;
  }

  try {
    component.config.options = parseJSONValue(value, 'array', 'Cascader Options');
    inspectorState.notice = null;
    syncInspectorUI();
  } catch (error) {
    inspectorState.notice = {
      tone: 'error',
      message: error.message
    };
    renderProperties();
  }
}

function updateCollapsePanels(value, id) {
  const component = findComponentById(id);
  if (!component) {
    return;
  }

  try {
    component.config.panels = parseJSONValue(value, 'array', 'Collapse Panels');
    inspectorState.notice = null;
    syncInspectorUI();
  } catch (error) {
    inspectorState.notice = {
      tone: 'error',
      message: error.message
    };
    renderProperties();
  }
}

window.switchInspectorTab = switchInspectorTab;
window.updateInspectorField = updateInspectorField;
window.toggleInspectorField = toggleInspectorField;
window.updateOptionsEditorField = updateOptionsEditorField;
window.addOptionsEditorRow = addOptionsEditorRow;
window.removeOptionsEditorRow = removeOptionsEditorRow;
window.updateCollapsePanelField = updateCollapsePanelField;
window.addCollapseEditorPanel = addCollapseEditorPanel;
window.removeCollapseEditorPanel = removeCollapseEditorPanel;
window.applyColumnPreset = applyColumnPreset;
