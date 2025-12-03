// Render component preview
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
                  <span>Please select date</span>
              </div>`;
    case 'TimePicker':
      return `<div class="date-picker-preview">
                  <i class="fas fa-clock"></i>
                  <span>Please select time</span>
              </div>`;
    case 'Card':
      return `<div class="card-preview ${component.config.showTitle ? 'with-title' : ''} ${state.showBorders ? 'with-borders' : ''}">
                  ${component.children && component.children.length > 0 
                    ? component.children.map(child => 
                        `<div class="form-item ${state.selectedItem?.id === child.id ? 'selected' : ''}" 
                             data-id="${child.id}"
                             draggable="true"
                             style="margin-bottom: 10px;"
                             onclick="event.stopPropagation(); const component = findComponentById('${child.id}'); if(component) selectComponent(component);">
                           <span class="form-item-label">${child.config.title}</span>
                           <div class="form-item-content">
                               ${renderComponentPreview(child)}
                           </div>
                           <div class="form-item-actions">
                               <i class="fas fa-edit form-item-action" onclick="event.stopPropagation(); editComponent('${child.id}')"></i>
                               <i class="fas fa-trash form-item-action" onclick="event.stopPropagation(); deleteChildComponent('${component.id}', '${child.id}')"></i>
                           </div>
                        </div>`)
                    : ''}
                  <div class="container-drop-area" data-container-id="${component.id}">
                     Drag components here to add to card
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
                                 draggable="true"
                                 onclick="event.stopPropagation(); const component = findComponentById('${child.id}'); if(component) selectComponent(component);">
                              <span class="form-item-label">${child.config.title}</span>
                              <div class="form-item-content">
                                  ${renderComponentPreview(child)}
                              </div>
                              <div class="form-item-actions">
                                  <i class="fas fa-edit form-item-action" onclick="event.stopPropagation(); editComponent('${child.id}')"></i>
                                  <i class="fas fa-trash form-item-action" onclick="event.stopPropagation(); deleteChildComponent('${component.id}', '${child.id}')"></i>
                              </div>
                            </div>`)
                        : ''}
                      <div class="container-drop-area" data-container-id="${component.id}" data-column="${i}">
                         Drag components to this column
                      </div>
                    </div>`;
      }
      return `<div class="grid-preview ${state.showBorders ? 'with-borders' : ''}">
                  <div class="grid-columns">${gridCols}</div>
              </div>`;
    case 'Switch':
      return `<button class="ant-switch" style="vertical-align: middle;" disabled></button>`;
    case 'Radio':
      const radioOptions = component.config.options || ['Option 1', 'Option 2'];
      return `<div class="radio-preview">
                ${radioOptions.map((opt, idx) => `
                  <div class="radio-option">
                    <input type="radio" name="radio_${component.id}" ${idx === 0 ? 'checked' : ''} disabled>
                    <label>${opt}</label>
                  </div>
                `).join('')}
              </div>`;
    case 'Checkbox':
      const checkboxOptions = component.config.options || ['Option 1', 'Option 2', 'Option 3'];
      return `<div class="checkbox-preview">
                ${checkboxOptions.map(opt => `
                  <div class="checkbox-option">
                    <input type="checkbox" disabled>
                    <label>${opt}</label>
                  </div>
                `).join('')}
              </div>`;
    default:
      return `<span style="color: #999;">${component.type} component preview</span>`;
  }
}