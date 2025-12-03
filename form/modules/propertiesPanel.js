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
                  <div class="property-field">
                      <label class="property-label">Option Configuration</label>
                      <textarea class="ant-input" style="height: 80px;"
                                onchange="updateProperty('options', this.value.split('\n'))">${(comp.config.options || []).join('\n')}</textarea>
                      <p style="font-size: 12px; color: #999; margin-top: 4px;">One option per line</p>
                  </div>`;
  }

  if (comp.type === 'Checkbox') {
    propertiesHTML += `
                  <div class="property-field">
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