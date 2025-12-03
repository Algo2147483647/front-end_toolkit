// 初始化
document.addEventListener('DOMContentLoaded', function() {
  initDragAndDrop();
  initEventListeners();
  renderFormItems();
  initTabs(); // 初始化标签页
});

// 初始化标签页
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.panel-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // 更新激活的标签按钮
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // 显示对应的面板
      tabPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === tabName + 'Panel') {
          panel.classList.add('active');
        }
      });

      // 如果是组件树面板，则更新树结构
      if (tabName === 'tree') {
        renderComponentTree();
      }
    });
  });

  // 初始化边框切换按钮
  const toggleButton = document.getElementById('toggleBorders');
  toggleButton.addEventListener('click', function() {
    state.showBorders = !state.showBorders;
    const icon = this.querySelector('i');
    if (state.showBorders) {
      icon.className = 'fas fa-border-none';
      this.title = '隐藏边框';
    } else {
      icon.className = 'fas fa-border-all';
      this.title = '显示边框';
    }
    renderFormItems();
  });
}

// 初始化拖拽功能
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
  
  // 添加对容器组件内部拖拽的支持
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
  
  // 添加对容器内组件拖拽排序的支持
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

// 添加组件
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
    children: (type === 'Card' || type === 'Grid') ? [] : undefined // 容器组件支持子组件
  };

  state.components.push(component);
  selectComponent(component);
  renderFormItems();
  renderComponentTree(); // 更新组件树
  updateSchema();
}

// 向容器组件添加子组件
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

  // 对于栅格组件，我们需要记录它属于哪一列
  if (container.type === 'Grid') {
    // 查找最少元素的列
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
  renderComponentTree(); // 更新组件树
  updateSchema();
}

// 渲染表单项目
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

  // 添加点击选择事件
  container.querySelectorAll('.form-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (!e.target.closest('.form-item-action')) {
        const id = this.dataset.id;
        const component = findComponentById(id);
        selectComponent(component);
      }
    });
  });
  
  // 为容器内的组件添加点击事件监听器
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

// 获取组件图标
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

// 删除组件
function deleteComponent(id) {
  const index = state.components.findIndex(c => c.id === id);
  if (index > -1) {
    state.components.splice(index, 1);
    if (state.selectedItem?.id === id) {
      state.selectedItem = null;
    }
    renderFormItems();
    renderProperties();
    renderComponentTree(); // 更新组件树
    updateSchema();
  }
}

// 删除容器中的子组件
function deleteChildComponent(containerId, childId) {
  const container = findComponentById(containerId);
  if (container && container.children) {
    const index = container.children.findIndex(c => c.id === childId);
    if (index > -1) {
      container.children.splice(index, 1);
      
      // 更新选中状态
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

// 编辑组件
function editComponent(id) {
  const component = findComponentById(id);
  selectComponent(component);
}

// 拖拽排序
function startDrag(e, id) {
  // 简单的拖拽重新排序实现
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
      renderComponentTree(); // 更新组件树
      updateSchema();
    }
  };

  document.onmouseup = function() {
    document.onmousemove = null;
    document.onmouseup = null;
  };
}