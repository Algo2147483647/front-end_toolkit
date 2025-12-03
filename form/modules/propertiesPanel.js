// Render properties panel
function renderProperties() {
  const container = document.getElementById('propertiesContent');

  if (!state.selectedItem) {
    container.innerHTML = '<p style="color: #999; text-align: center;">Please select a component to configure</p>';
    return;
  }

  const comp = state.selectedItem;
  let propertiesHTML = `
              <div class="property-field">
                  <label class="property-label">Component Type</label>
                  <input class="ant-input" value="${comp.type}" disabled>
              </div>
              <div class="property-field">
                  <label class="property-label">Field Name</label>
                  <input class="ant-input" value="${comp.config.name}"
                         onchange="updateProperty('name', this.value)">
              </div>
              <div class="property-field">
                  <label class="property-label">Display Title</label>
                  <input class="ant-input" value="${comp.config.title}"
                         onchange="updateProperty('title', this.value)">
              </div>`;

  // For layout components, add special configuration items
  if (comp.type === 'Card' || comp.type === 'Divider' || comp.type === 'Grid') {
    propertiesHTML += `
                <div class="property-field">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" ${comp.config.showTitle ? 'checked' : ''}
                               onchange="updateProperty('showTitle', this.checked)">
                        <span>Show Main Title</span>
                    </label>
                </div>`;
  }
  
  if (comp.type === 'Collapse') {
    const panels = comp.config.panels || [];
    propertiesHTML += `
                <div class="property-field">
                    <label class="property-label">Direction</label>
                    <select class="ant-input" onchange="updateProperty('direction', this.value)">
                      <option value="vertical" ${comp.config.direction === 'vertical' ? 'selected' : ''}>Vertical</option>
                      <option value="horizontal" ${comp.config.direction === 'horizontal' ? 'selected' : ''}>Horizontal</option>
                    </select>
                </div>
                <div class="property-field vertical">
                    <label class="property-label">Collapse Panels</label>
                    <textarea class="ant-input" style="height: 120px;"
                              onchange="updateCollapsePanels(this.value, '${comp.id}')">${JSON.stringify(panels, null, 2)}</textarea>
                    <p style="font-size: 12px; color: #999; margin-top: 4px;">Enter in JSON format</p>
                </div>`;
  }

  if (comp.type === 'Input') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">Placeholder</label>
                      <input class="ant-input" value="${comp.config.placeholder || ''}"
                             onchange="updateProperty('placeholder', this.value)">
                  </div>`;
  }
  
  if (comp.type === 'Textarea') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">Placeholder</label>
                      <input class="ant-input" value="${comp.config.placeholder || ''}"
                             onchange="updateProperty('placeholder', this.value)">
                  </div>`;
  }

  if (comp.type === 'Select' || comp.type === 'Radio') {
    propertiesHTML += `
                  <div class="property-field vertical">
                      <label class="property-label">Option Configuration</label>
                      <textarea class="ant-input" style="height: 80px;"
                                onchange="updateProperty('options', this.value.split('\n'))">${(comp.config.options || []).join('\n')}</textarea>
                      <p style="font-size: 12px; color: #999; margin-top: 4px;">One option per line</p>
                  </div>`;
  }
  
  if (comp.type === 'Cascader') {
    propertiesHTML += `
                  <div class="property-field vertical">
                      <label class="property-label">Cascader Options</label>
                      <textarea class="ant-input" style="height: 120px;"
                                onchange="updateCascaderOptions(this.value, '${comp.id}')">${JSON.stringify(comp.config.options || [], null, 2)}</textarea>
                      <p style="font-size: 12px; color: #999; margin-top: 4px;">Enter in JSON format</p>
                  </div>`;
  }

  if (comp.type === 'Checkbox') {
    propertiesHTML += `
                  <div class="property-field vertical">
                      <label class="property-label">Option Configuration</label>
                      <textarea class="ant-input" style="height: 80px;"
                                onchange="updateProperty('options', this.value.split('\n'))">${(comp.config.options || []).join('\n')}</textarea>
                      <p style="font-size: 12px; color: #999; margin-top: 4px;">One option per line</p>
                  </div>`;
  }

  if (comp.type === 'Divider') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">Divider Text</label>
                      <input class="ant-input" value="${comp.config.content || ''}"
                             onchange="updateProperty('content', this.value)">
                  </div>`;
  }
  
  if (comp.type === 'Grid') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">Columns</label>
                      <input type="number" class="ant-input" min="1" max="12" value="${comp.config.columns || 3}"
                             onchange="updateProperty('columns', parseInt(this.value))">
                  </div>`;
  }

  if (comp.type === 'ColorPicker') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">Default Color</label>
                      <input type="color" class="ant-input" value="${comp.config.defaultValue || '#1890ff'}"
                             onchange="updateProperty('defaultValue', this.value)">
                      <input class="ant-input" value="${comp.config.defaultValue || '#1890ff'}"
                             onchange="updateProperty('defaultValue', this.value)" style="margin-top: 5px;">
                  </div>`;
  }

  if (comp.type === 'Slider') {
    propertiesHTML += `
                  <div class="property-field">
                      <label class="property-label">Min Value</label>
                      <input type="number" class="ant-input" value="${comp.config.min || 0}"
                             onchange="updateProperty('min', parseInt(this.value))">
                  </div>
                  <div class="property-field">
                      <label class="property-label">Max Value</label>
                      <input type="number" class="ant-input" value="${comp.config.max || 100}"
                             onchange="updateProperty('max', parseInt(this.value))">
                  </div>
                  <div class="property-field">
                      <label class="property-label">Default Value</label>
                      <input type="number" class="ant-input" value="${comp.config.defaultValue || 0}"
                             onchange="updateProperty('defaultValue', parseInt(this.value))">
                  </div>`;
  }

  if (comp.type !== 'Divider' && comp.type !== 'Card' && comp.type !== 'Grid') {
    propertiesHTML += `
                  <div class="property-field">
                      <label style="display: flex; align-items: center; gap: 8px;">
                          <input type="checkbox" ${comp.config.required ? 'checked' : ''}
                                 onchange="updateProperty('required', this.checked)">
                          <span>Required</span>
                      </label>
                  </div>
                  <div class="property-field">
                      <label class="property-label">Default Value</label>
                      <input class="ant-input" value="${comp.config.defaultValue || ''}"
                             onchange="updateProperty('defaultValue', this.value)">
                  </div>`;
  }

  container.innerHTML = propertiesHTML;
}

// Update component property
function updateProperty(key, value) {
  if (state.selectedItem) {
    state.selectedItem.config[key] = value;
    renderFormItems();
    renderComponentTree(); // Update component tree
    updateSchema();
  }
}

// Update cascader options
function updateCascaderOptions(value, id) {
  const component = findComponentById(id);
  if (component && component.type === 'Cascader') {
    try {
      const options = JSON.parse(value);
      component.config.options = options;
      renderFormItems();
      renderComponentTree();
      updateSchema();
    } catch (e) {
      console.error('Invalid JSON for cascader options:', e);
    }
  }
}

// Update collapse panels
function updateCollapsePanels(value, id) {
  const component = findComponentById(id);
  if (component && component.type === 'Collapse') {
    try {
      const panels = JSON.parse(value);
      component.config.panels = panels;
      renderFormItems();
      renderComponentTree();
      updateSchema();
    } catch (e) {
      console.error('Invalid JSON for collapse panels:', e);
    }
  }
}
