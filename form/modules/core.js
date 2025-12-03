// Initialize
document.addEventListener('DOMContentLoaded', function() {
  initDragAndDrop();
  initEventListeners();
  renderFormItems();
  initTabs(); // Initialize tabs
});

// Initialize tabs
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.panel-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Show corresponding panel
      tabPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === tabName + 'Panel') {
          panel.classList.add('active');
        }
      });

      // If it's the component tree panel, update the tree structure
      if (tabName === 'tree') {
        renderComponentTree();
      }
    });
  });

  // Initialize border toggle button
  const toggleButton = document.getElementById('toggleBorders');
  toggleButton.addEventListener('click', function() {
    state.showBorders = !state.showBorders;
    const icon = this.querySelector('i');
    if (state.showBorders) {
      icon.className = 'fas fa-border-none';
      this.title = 'Hide Borders';
    } else {
      icon.className = 'fas fa-border-all';
      this.title = 'Show Borders';
    }
    renderFormItems();
  });
}

// Initialize drag and drop functionality
function initDragAndDrop() {
  const components = document.querySelectorAll('.component-item');
  const canvas = document.getElementById('formCanvas');

  components.forEach(component => {
    component.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('componentType', this.dataset.type);
      this.classList.add('dragging');
    });

    component.addEventListener('dragend', function() {
      this.classList.remove('dragging');
    });
  });

  canvas.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.classList.add('active');
  });

  canvas.addEventListener('dragleave', function() {
    this.classList.remove('active');
  });

  canvas.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('active');

    const componentType = e.dataTransfer.getData('componentType');
    if (componentType) {
      addComponent(componentType);
    }
  });
  
  // Add support for dragging inside container components
  document.addEventListener('dragover', function(e) {
    if (e.target.classList.contains('container-drop-area')) {
      e.preventDefault();
      e.target.classList.add('active');
    }
  });

  document.addEventListener('dragleave', function(e) {
    if (e.target.classList.contains('container-drop-area')) {
      e.target.classList.remove('active');
    }
  });

  document.addEventListener('drop', function(e) {
    if (e.target.classList.contains('container-drop-area')) {
      e.preventDefault();
      e.target.classList.remove('active');

      const componentType = e.dataTransfer.getData('componentType');
      const containerId = e.target.dataset.containerId;
      
      if (componentType && containerId) {
        addComponentToContainer(containerId, componentType);
      }
    }
  });
  
  // Add support for dragging and sorting components within containers
  document.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('form-item') && e.target.parentNode.classList.contains('card-preview')) {
      e.dataTransfer.setData('text/plain', e.target.dataset.id);
    }
  });
  
  document.addEventListener('dragover', function(e) {
    if (e.target.classList.contains('card-preview')) {
      e.preventDefault();
    }
  });
}

// Add component
function addComponent(type) {
  const id = 'comp_' + state.nextId++;
  const config = JSON.parse(JSON.stringify(componentConfigs[type]));

  const component = {
    id,
    type,
    config: {
      ...config,
      name: config.name + '_' + id
    },
    position: state.components.length,
    children: (type === 'Card' || type === 'Grid') ? [] : undefined // Container components support child components
  };

  state.components.push(component);
  selectComponent(component);
  renderFormItems();
  renderComponentTree(); // Update component tree
  updateSchema();
}

// Add child component to container
function addComponentToContainer(containerId, type) {
  const container = findComponentById(containerId);
  if (!container) return;

  const id = 'comp_' + state.nextId++;
  const config = JSON.parse(JSON.stringify(componentConfigs[type]));

  const childComponent = {
    id,
    type,
    config: {
      ...config,
      name: config.name + '_' + id
    },
    position: container.children.length
  };

  // For grid components, we need to record which column it belongs to
  if (container.type === 'Grid') {
    // Find the column with the least elements
    const columns = container.config.columns || 3;
    let minCount = Infinity;
    let targetColumn = 0;
    
    for (let i = 0; i < columns; i++) {
      const count = container.children.filter(child => child.position === i).length;
      if (count < minCount) {
        minCount = count;
        targetColumn = i;
      }
    }
    
    childComponent.position = targetColumn;
  }

  container.children.push(childComponent);
  selectComponent(childComponent);
  renderFormItems();
  renderComponentTree(); // Update component tree
  updateSchema();
}

// Render form items
function renderFormItems() {
  const container = document.getElementById('formItems');
  const emptyCanvas = document.getElementById('emptyCanvas');

  if (state.components.length === 0) {
    emptyCanvas.style.display = 'flex';
    container.innerHTML = '';
    return;
  }

  emptyCanvas.style.display = 'none';
  container.innerHTML = state.components.map(comp => `
              <div class="form-item ${state.selectedItem?.id === comp.id ? 'selected' : ''} ${state.showBorders ? 'with-borders' : ''}"
                   data-id="${comp.id}"
                   draggable="true">
                  <span class="form-item-label">${comp.config.title}</span>
                  <div class="form-item-content">
                      ${renderComponentPreview(comp)}
                  </div>
                  <div class="form-item-actions">
                      <i class="fas fa-edit form-item-action" onclick="event.stopPropagation(); editComponent('${comp.id}')"></i>
                      <i class="fas fa-trash form-item-action" onclick="event.stopPropagation(); deleteComponent('${comp.id}')"></i>
                      <i class="fas fa-arrows-alt form-item-action"
                         onmousedown="startDrag(event, '${comp.id}')"></i>
                  </div>
              </div>
          `).join('');

  // Add click selection event
  container.querySelectorAll('.form-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (!e.target.closest('.form-item-action')) {
        const id = this.dataset.id;
        const component = findComponentById(id);
        selectComponent(component);
      }
    });
  });
  
  // Add click event listeners for components within containers
  container.querySelectorAll('.card-preview > .form-item, .grid-column > .form-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (!e.target.closest('.form-item-action')) {
        e.stopPropagation();
        const id = this.dataset.id;
        const component = findComponentById(id);
        selectComponent(component);
      }
    });
  });
}

// Get component icon
function getComponentIcon(type) {
  const icons = {
    Input: 'font',
    Textarea: 'align-left',
    InputNumber: 'sort-numeric-up',
    Select: 'list',
    DatePicker: 'calendar-alt',
    TimePicker: 'clock',
    Card: 'square',
    Divider: 'minus',
    Switch: 'toggle-on',
    Slider: 'sliders-h',
    Radio: 'dot-circle',
    Checkbox: 'check-square'
  };
  return icons[type] || 'cube';
}

// Delete component
function deleteComponent(id) {
  const index = state.components.findIndex(c => c.id === id);
  if (index > -1) {
    state.components.splice(index, 1);
    if (state.selectedItem?.id === id) {
      state.selectedItem = null;
    }
    renderFormItems();
    renderProperties();
    renderComponentTree(); // Update component tree
    updateSchema();
  }
}

// Delete child component from container
function deleteChildComponent(containerId, childId) {
  const container = findComponentById(containerId);
  if (container && container.children) {
    const index = container.children.findIndex(c => c.id === childId);
    if (index > -1) {
      container.children.splice(index, 1);
      
      // Update selection state
      if (state.selectedItem?.id === childId) {
        state.selectedItem = null;
        renderProperties();
      }
      
      renderFormItems();
      renderComponentTree();
      updateSchema();
    }
  }
}

// Edit component
function editComponent(id) {
  const component = findComponentById(id);
  selectComponent(component);
}

// Drag to reorder
function startDrag(e, id) {
  // Simple drag and reorder implementation
  e.stopPropagation();
  const component = state.components.find(c => c.id === id);
  if (!component) return;

  const dragStart = e.clientY;
  const originalIndex = component.position;

  document.onmousemove = function(moveEvent) {
    const delta = moveEvent.clientY - dragStart;
    const newIndex = Math.max(0, Math.min(state.components.length - 1,
            originalIndex + Math.round(delta / 50)));

    if (newIndex !== component.position) {
      const otherComp = state.components.find(c => c.position === newIndex);
      if (otherComp) {
        otherComp.position = component.position;
      }
      component.position = newIndex;

      state.components.sort((a, b) => a.position - b.position);
      renderFormItems();
      renderComponentTree(); // Update component tree
      updateSchema();
    }
  };

  document.onmouseup = function() {
    document.onmousemove = null;
    document.onmouseup = null;
  };
}