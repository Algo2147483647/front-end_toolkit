// 渲染组件树
function renderComponentTree() {
  const treeContainer = document.getElementById('componentTree');
  
  if (state.components.length === 0) {
    treeContainer.innerHTML = '<li class="tree-empty">暂无组件</li>';
    return;
  }

  treeContainer.innerHTML = state.components.map(component => renderTreeNode(component, 0)).join('');
  
  // 添加节点点击事件
  treeContainer.querySelectorAll('.tree-node').forEach(node => {
    node.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = this.dataset.id;
      const component = findComponentById(id);
      if (component) {
        selectComponent(component);
        // 不再切换到组件库面板，保持当前面板状态
        // 只需要确保组件树面板是激活的即可
      }
    });
  });
}

// 渲染树节点
function renderTreeNode(component, level) {
  const isSelected = state.selectedItem?.id === component.id;
  const icon = getComponentIcon(component.type);
  const hasChildren = component.children && component.children.length > 0;
  
  let html = `
    <li>
      <div class="tree-node ${isSelected ? 'selected' : ''}" data-id="${component.id}">
        ${hasChildren ? '<i class="tree-expand-icon fas fa-caret-right"></i>' : '<i class="tree-expand-icon-placeholder"></i>'}
        <i class="node-icon fas fa-${icon}"></i>
        <span class="node-label">${component.config.title || component.type}</span>
        <span class="node-type">${component.type}</span>
      </div>
  `;
  
  // 渲染子节点
  if (hasChildren) {
    html += `<ul>`;
    component.children.forEach(child => {
      html += renderTreeNode(child, level + 1);
    });
    html += `</ul>`;
  }
  
  html += `</li>`;
  return html;
}