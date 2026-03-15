function flattenCascaderOptions(options, trail = []) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.flatMap(option => {
    if (!option || typeof option !== 'object') {
      return [];
    }

    const label = option.label !== undefined ? String(option.label) : String(option.value || '');
    const value = option.value !== undefined ? String(option.value) : label;
    const nextTrail = trail.concat({ label, value });

    if (Array.isArray(option.children) && option.children.length > 0) {
      return flattenCascaderOptions(option.children, nextTrail);
    }

    return [{
      label: nextTrail.map(item => item.label).join(' / '),
      value: nextTrail.map(item => item.value).join('/')
    }];
  });
}

// Render component preview
function renderComponentPreview(component, isPreview = false) {
  const fieldName = escapeAttribute(component.config.name);
  const fieldTitle = escapeHTML(component.config.title);
  const placeholder = escapeAttribute(component.config.placeholder || '');
  const defaultValue = component.config.defaultValue;

  switch (component.type) {
    case 'Input':
      return `<input type="text" class="ant-input" name="${fieldName}" value="${escapeAttribute(defaultValue || '')}" placeholder="${placeholder}" ${isPreview ? '' : 'disabled'}>`;
    case 'Textarea':
      return `<textarea class="ant-input" name="${fieldName}" placeholder="${placeholder}" ${isPreview ? '' : 'disabled'} style="height: 80px;">${escapeHTML(defaultValue || '')}</textarea>`;
    case 'InputNumber':
      return `
        <div class="number-input-wrapper">
          <input type="number" class="ant-input" name="${fieldName}" value="${escapeAttribute(defaultValue ?? 0)}" ${isPreview ? '' : 'disabled'}>
          <div class="number-input-controls" style="${isPreview ? 'opacity: 1;' : ''}">
            <button type="button" class="number-input-control number-input-control-up" ${isPreview ? 'onclick="incrementNumber(this)"' : 'disabled'}>+</button>
            <button type="button" class="number-input-control number-input-control-down" ${isPreview ? 'onclick="decrementNumber(this)"' : 'disabled'}>-</button>
          </div>
        </div>`;
    case 'Select':
      return `<select class="ant-select" name="${fieldName}" ${isPreview ? 'onchange="handleSelectChange(this)"' : 'disabled'}>
        ${(component.config.options || []).map(opt => {
          const optionValue = String(opt);
          const selected = defaultValue === optionValue ? 'selected' : '';
          return `<option value="${escapeAttribute(optionValue)}" ${selected}>${escapeHTML(optionValue)}</option>`;
        }).join('')}
      </select>`;
    case 'Cascader': {
      const options = flattenCascaderOptions(component.config.options || []);
      const selectedValue = Array.isArray(defaultValue) ? defaultValue.join('/') : String(defaultValue || '');
      return `<select class="ant-select" name="${fieldName}" ${isPreview ? '' : 'disabled'}>
        <option value="">Please select</option>
        ${options.map(option => {
          const selected = option.value === selectedValue ? 'selected' : '';
          return `<option value="${escapeAttribute(option.value)}" ${selected}>${escapeHTML(option.label)}</option>`;
        }).join('')}
      </select>`;
    }
    case 'DatePicker':
      return `<input type="date" class="ant-input" name="${fieldName}" value="${escapeAttribute(defaultValue || '')}" ${isPreview ? '' : 'disabled'}>`;
    case 'TimePicker':
      return `<input type="time" class="ant-input" name="${fieldName}" value="${escapeAttribute(defaultValue || '')}" ${isPreview ? '' : 'disabled'}>`;
    case 'Card':
      return `<div class="card-preview ${component.config.showTitle ? 'with-title' : ''} ${state.showBorders && !isPreview ? 'with-borders' : ''}" data-container-type="Card" data-container-id="${component.id}">
        ${component.children && component.children.length > 0
          ? component.children.map(child => {
              if (isPreview) {
                return `<div class="form-item" data-id="${child.id}" style="margin-bottom: 10px;">
                  <span class="form-item-label">${escapeHTML(child.config.title)}</span>
                  <div class="form-item-content">
                    ${renderComponentPreview(child, true)}
                  </div>
                </div>`;
              }

              return `<div class="form-item ${state.selectedItem?.id === child.id ? 'selected' : ''}"
                   data-id="${child.id}"
                   draggable="true"
                   style="margin-bottom: 10px;"
                   onclick="event.stopPropagation(); const component = findComponentById('${child.id}'); if(component) selectComponent(component);">
                 <span class="form-item-label">${escapeHTML(child.config.title)}</span>
                 <div class="form-item-content">
                   ${renderComponentPreview(child)}
                 </div>
                 <div class="form-item-actions">
                   <i class="fas fa-edit form-item-action" onclick="event.stopPropagation(); editComponent('${child.id}')"></i>
                   <i class="fas fa-trash form-item-action" onclick="event.stopPropagation(); deleteChildComponent('${component.id}', '${child.id}')"></i>
                 </div>
              </div>`;
            }).join('')
          : ''}
        ${isPreview ? '' : `
          <div class="container-drop-area" data-container-id="${component.id}">
            Drag components here to add to card
          </div>
        `}
      </div>`;
    case 'Divider':
      if (component.config.content) {
        return `<div class="divider-preview"><span>${escapeHTML(component.config.content)}</span></div>`;
      }
      return `<div class="divider-preview no-title"><span></span></div>`;
    case 'Grid': {
      const columns = component.config.columns || 3;
      let gridCols = '';

      for (let i = 0; i < columns; i++) {
        const colChildren = component.children ? component.children.filter(child => child.position === i) : [];
        gridCols += `<div class="grid-column">
          ${colChildren.length > 0
            ? colChildren.map(child => {
                if (isPreview) {
                  return `<div class="form-item" data-id="${child.id}">
                    <span class="form-item-label">${escapeHTML(child.config.title)}</span>
                    <div class="form-item-content">
                      ${renderComponentPreview(child, true)}
                    </div>
                  </div>`;
                }

                return `<div class="form-item ${state.selectedItem?.id === child.id ? 'selected' : ''}"
                     data-id="${child.id}"
                     draggable="true"
                     onclick="event.stopPropagation(); const component = findComponentById('${child.id}'); if(component) selectComponent(component);">
                   <span class="form-item-label">${escapeHTML(child.config.title)}</span>
                   <div class="form-item-content">
                     ${renderComponentPreview(child)}
                   </div>
                   <div class="form-item-actions">
                     <i class="fas fa-edit form-item-action" onclick="event.stopPropagation(); editComponent('${child.id}')"></i>
                     <i class="fas fa-trash form-item-action" onclick="event.stopPropagation(); deleteChildComponent('${component.id}', '${child.id}')"></i>
                   </div>
                 </div>`;
              }).join('')
            : ''}
          ${isPreview ? '' : `
            <div class="container-drop-area" data-container-id="${component.id}" data-column="${i}">
              Drag components to this column
            </div>
          `}
        </div>`;
      }

      return `<div class="grid-preview ${state.showBorders && !isPreview ? 'with-borders' : ''}">
        <div class="grid-columns">${gridCols}</div>
      </div>`;
    }
    case 'Collapse': {
      const direction = component.config.direction || 'vertical';
      const panels = component.config.panels || [];

      if (direction === 'horizontal') {
        let collapseTabsHeader = '';
        let collapseTabsContent = '';

        panels.forEach((panel, index) => {
          const isActiveTab = index === 0 ? 'active' : '';
          collapseTabsHeader += `
            <div class="collapse-tab-header ${isActiveTab}" data-index="${index}">
              <span class="collapse-tab-title">${escapeHTML(panel.title)}</span>
              ${isPreview ? '' : `
                <div class="collapse-tab-actions">
                  <i class="fas fa-plus add-panel" onclick="event.stopPropagation(); addCollapsePanel('${component.id}', ${index})"></i>
                  <i class="fas fa-minus remove-panel" onclick="event.stopPropagation(); removeCollapsePanel('${component.id}', ${index})"></i>
                </div>
              `}
            </div>`;

          const isActiveContent = index === 0 ? 'active' : '';
          const contentStyle = index === 0 ? 'style="display: block;"' : '';
          collapseTabsContent += `
            <div class="collapse-tab-content ${isActiveContent}" data-index="${index}" ${contentStyle}>
              <div class="collapse-content-inner">${escapeHTML(panel.content)}</div>
            </div>`;
        });

        return `<div class="collapse-preview horizontal-tab" onclick="event.stopPropagation();" data-component-id="${component.id}">
          <div class="collapse-tabs-headers">
            ${collapseTabsHeader}
          </div>
          <div class="collapse-tabs-contents">
            ${collapseTabsContent}
          </div>
          ${isPreview ? '' : `
            <div class="collapse-global-actions">
              <i class="fas fa-plus add-panel" onclick="event.stopPropagation(); addCollapsePanel('${component.id}', -1)"></i>
            </div>
          `}
        </div>`;
      }

      const collapsePanels = panels.map((panel, index) => `
        <div class="collapse-panel" data-index="${index}">
          <div class="collapse-header">
            <i class="fas fa-chevron-right collapse-arrow"></i>
            <span class="collapse-title">${escapeHTML(panel.title)}</span>
            ${isPreview ? '' : `
              <div class="collapse-panel-actions">
                <i class="fas fa-plus add-panel" onclick="event.stopPropagation(); addCollapsePanel('${component.id}', ${index})"></i>
                <i class="fas fa-minus remove-panel" onclick="event.stopPropagation(); removeCollapsePanel('${component.id}', ${index})"></i>
              </div>
            `}
          </div>
          <div class="collapse-content">
            <div class="collapse-content-inner">${escapeHTML(panel.content)}</div>
          </div>
        </div>`).join('');

      return `<div class="collapse-preview vertical" onclick="event.stopPropagation();" data-component-id="${component.id}">
        ${collapsePanels}
        ${isPreview ? '' : `
          <div class="collapse-global-actions">
            <i class="fas fa-plus add-panel" onclick="event.stopPropagation(); addCollapsePanel('${component.id}', -1)"></i>
          </div>
        `}
      </div>`;
    }
    case 'Switch': {
      const checked = !!defaultValue;
      const trackStyle = checked ? 'background-color: #1890ff;' : 'background-color: #ccc;';
      const thumbStyle = checked ? 'transform: translateX(20px);' : 'transform: translateX(0);';
      const label = checked ? 'ON' : 'OFF';

      if (isPreview) {
        return `
          <div class="switch-preview" data-checked="${checked ? '1' : '0'}" onclick="toggleSwitch(this)">
            <div class="switch-track" style="${trackStyle}">
              <div class="switch-thumb" style="${thumbStyle}"></div>
            </div>
            <span class="switch-label">${label}</span>
            <input type="hidden" name="${fieldName}" value="${checked ? 'true' : 'false'}">
          </div>`;
      }

      return `
        <div class="switch-preview" data-checked="${checked ? '1' : '0'}">
          <div class="switch-track" style="${trackStyle}">
            <div class="switch-thumb" style="${thumbStyle}"></div>
          </div>
          <span class="switch-label">${label}</span>
          <input type="hidden" name="${fieldName}" value="${checked ? 'true' : 'false'}">
        </div>`;
    }
    case 'Slider':
      return `<div class="slider-preview">
        <input type="range"
               name="${fieldName}"
               min="${escapeAttribute(component.config.min || 0)}"
               max="${escapeAttribute(component.config.max || 100)}"
               value="${escapeAttribute(defaultValue ?? 0)}"
               ${isPreview ? 'oninput="updateSliderValue(this)"' : 'disabled'}
               class="ant-slider">
        <div class="slider-value">${escapeHTML(defaultValue ?? 0)}</div>
      </div>`;
    case 'Radio': {
      const radioOptions = component.config.options || ['Option 1', 'Option 2'];
      return `<div class="radio-preview">
        ${radioOptions.map((opt, idx) => {
          const optionValue = String(opt);
          const checked = defaultValue ? defaultValue === optionValue : idx === 0;
          return `
            <div class="radio-option">
              <input type="radio" name="${fieldName}" value="${escapeAttribute(optionValue)}" ${checked ? 'checked' : ''} ${isPreview ? 'onchange="handleRadioChange(this)"' : 'disabled'}>
              <label>${escapeHTML(optionValue)}</label>
            </div>`;
        }).join('')}
      </div>`;
    }
    case 'Checkbox': {
      const checkboxOptions = component.config.options || ['Option 1', 'Option 2', 'Option 3'];
      const selectedValues = Array.isArray(defaultValue) ? defaultValue.map(String) : [];
      return `<div class="checkbox-preview">
        ${checkboxOptions.map(opt => {
          const optionValue = String(opt);
          return `
            <div class="checkbox-option">
              <input type="checkbox" name="${fieldName}[]" value="${escapeAttribute(optionValue)}" ${selectedValues.includes(optionValue) ? 'checked' : ''} ${isPreview ? 'onchange="handleCheckboxChange(this)"' : 'disabled'}>
              <label>${escapeHTML(optionValue)}</label>
            </div>`;
        }).join('')}
      </div>`;
    }
    case 'ColorPicker':
      return `<input type="color" class="ant-input" name="${fieldName}" value="${escapeAttribute(defaultValue || '#1890ff')}" ${isPreview ? '' : 'disabled'}>`;
    default:
      return `<span style="color: #999;">${fieldTitle || escapeHTML(component.type)} component preview</span>`;
  }
}
