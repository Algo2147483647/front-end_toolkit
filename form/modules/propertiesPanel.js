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