export function createSelectionController({ state, model, renderer }) {
  function refreshSelectionState() {
    renderer.refresh({
      tree: true,
      inspector: true,
      overlay: true,
      actions: true
    });
  }

  function snapshotEditorState() {
    return {
      selectedNodeKey: state.selectedNodeKey,
      selectedNodeKeys: [...state.selectedNodeKeys],
      collapsedNodeKeys: [...state.collapsedNodeKeys],
      lockedNodeKeys: [...state.lockedNodeKeys]
    };
  }

  function restoreEditorState(snapshot) {
    state.selectedNodeKey = snapshot?.selectedNodeKey || null;
    state.selectedNodeKeys = new Set(snapshot?.selectedNodeKeys || []);
    state.collapsedNodeKeys = new Set(snapshot?.collapsedNodeKeys || []);
    state.lockedNodeKeys = new Set(snapshot?.lockedNodeKeys || []);
  }

  function resetEditorState() {
    restoreEditorState(null);
    state.selectedId = null;
    state.selectedIds = new Set();
    state.selectionBox = null;
  }

  function remapMetadataKey(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) {
      return;
    }

    if (state.selectedNodeKey === oldKey) {
      state.selectedNodeKey = newKey;
    }

    if (state.selectedNodeKeys.delete(oldKey)) {
      state.selectedNodeKeys.add(newKey);
    }

    if (state.collapsedNodeKeys.delete(oldKey)) {
      state.collapsedNodeKeys.add(newKey);
    }

    if (state.lockedNodeKeys.delete(oldKey)) {
      state.lockedNodeKeys.add(newKey);
    }
  }

  function setSelection(editorIds, options = {}) {
    const { primaryId = null, render = true } = options;
    const validIds = [...new Set(editorIds.filter((editorId) => state.nodeMap.has(editorId)))];
    const nextPrimaryId = validIds.includes(primaryId)
      ? primaryId
      : (validIds[0] || null);

    state.selectedIds = new Set(validIds);
    state.selectedId = nextPrimaryId;
    state.selectedNodeKey = nextPrimaryId
      ? model.getNodeKeyByEditorId(nextPrimaryId)
      : null;
    state.selectedNodeKeys = new Set(
      validIds
        .map((editorId) => model.getNodeKeyByEditorId(editorId))
        .filter(Boolean)
    );

    if (render) {
      refreshSelectionState();
    }
  }

  function resolveLiveSelection(fallbackEditorId = state.svgRoot?.dataset.editorId || null) {
    const resolvedEditorIds = [...state.selectedNodeKeys]
      .map((nodeKey) => model.getEditorIdByNodeKey(nodeKey))
      .filter(Boolean);
    const resolvedEditorId = state.selectedNodeKey
      ? model.getEditorIdByNodeKey(state.selectedNodeKey)
      : null;
    const fallbackIds = resolvedEditorIds.length
      ? resolvedEditorIds
      : (fallbackEditorId ? [fallbackEditorId] : []);

    setSelection(fallbackIds, {
      primaryId: resolvedEditorId || fallbackIds[0] || null,
      render: false
    });
  }

  function getSelectedEditorIds() {
    return [...state.selectedIds].filter((editorId) => state.nodeMap.has(editorId));
  }

  function clearSelection(options = {}) {
    setSelection([], options);
  }

  function selectNode(editorId, options = {}) {
    setSelection(editorId ? [editorId] : [], {
      primaryId: editorId || null,
      render: options.render !== false
    });
  }

  function toggleNodeCollapse(editorId) {
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!nodeKey) {
      return;
    }

    if (state.collapsedNodeKeys.has(nodeKey)) {
      state.collapsedNodeKeys.delete(nodeKey);
    } else {
      state.collapsedNodeKeys.add(nodeKey);
    }

    renderer.refresh({ tree: true });
  }

  function toggleNodeLock(editorId) {
    const node = state.nodeMap.get(editorId);
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!node || !nodeKey || node === state.svgRoot) {
      return;
    }

    if (state.lockedNodeKeys.has(nodeKey)) {
      state.lockedNodeKeys.delete(nodeKey);
    } else {
      state.lockedNodeKeys.add(nodeKey);
    }

    renderer.refresh({
      tree: true,
      inspector: true,
      overlay: true,
      actions: true
    });
  }

  function getSelectionTargets() {
    const selectedIds = new Set(getSelectedEditorIds());

    return getSelectedEditorIds()
      .map((editorId) => state.nodeMap.get(editorId))
      .filter((node) => node && node !== state.svgRoot && node.parentNode)
      .filter((node) => {
        let parent = node.parentElement;
        while (parent) {
          if (selectedIds.has(parent.dataset?.editorId)) {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      });
  }

  return {
    clearSelection,
    getSelectedEditorIds,
    getSelectionTargets,
    refreshSelectionState,
    remapMetadataKey,
    resetEditorState,
    resolveLiveSelection,
    restoreEditorState,
    selectNode,
    setSelection,
    snapshotEditorState,
    toggleNodeCollapse,
    toggleNodeLock
  };
}
