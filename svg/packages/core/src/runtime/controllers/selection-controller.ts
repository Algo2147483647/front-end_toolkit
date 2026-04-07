import type { EditorStateSnapshot, SelectionController, SvgRenderer } from "../controller-types";
import type { EditorSvgElement, SvgModel } from "../model/types";
import type { SvgRuntimeState, SvgRuntimeStore } from "../runtime-store";

interface SelectionControllerDeps {
  store: SvgRuntimeStore;
  state: SvgRuntimeState;
  model: Pick<
    SvgModel,
    "getEditorIdByNodeKey" | "getNodeKey" | "getNodeKeyByEditorId" | "resolveSelectionEditorId"
  >;
  renderer: Pick<SvgRenderer, "refresh">;
}

export function createSelectionController({ store, state, model, renderer }: SelectionControllerDeps): SelectionController {
  const runtime = store?.getState?.() || state;

  function refreshSelectionState() {
    renderer.refresh({
      tree: true,
      inspector: true,
      overlay: true,
      actions: true
    });
  }

  function snapshotEditorState(): EditorStateSnapshot {
    return {
      selectedNodeKey: runtime.selectedNodeKey,
      selectedNodeKeys: [...runtime.selectedNodeKeys],
      collapsedNodeKeys: [...runtime.collapsedNodeKeys],
      lockedNodeKeys: [...runtime.lockedNodeKeys]
    };
  }

  function restoreEditorState(snapshot: EditorStateSnapshot | null) {
    store.selection.restoreEditorState(snapshot);
  }

  function resetEditorState() {
    store.selection.resetEditorState();
  }

  function remapMetadataKey(oldKey: string | null, newKey: string | null) {
    if (!oldKey || !newKey || oldKey === newKey) {
      return;
    }

    if (runtime.selectedNodeKey === oldKey) {
      runtime.selectedNodeKey = newKey;
    }

    if (runtime.selectedNodeKeys.delete(oldKey)) {
      runtime.selectedNodeKeys.add(newKey);
    }

    if (runtime.collapsedNodeKeys.delete(oldKey)) {
      runtime.collapsedNodeKeys.add(newKey);
    }

    if (runtime.lockedNodeKeys.delete(oldKey)) {
      runtime.lockedNodeKeys.add(newKey);
    }
  }

  function remapMetadataKeys(keyMap: Map<string, string>) {
    if (!(keyMap instanceof Map) || !keyMap.size) {
      return;
    }

    const remapSet = (currentSet: Set<string>) => {
      const nextSet = new Set<string>();
      currentSet.forEach((key) => {
        nextSet.add(keyMap.get(key) || key);
      });
      return nextSet;
    };

    if (runtime.selectedNodeKey) {
      runtime.selectedNodeKey = keyMap.get(runtime.selectedNodeKey) || runtime.selectedNodeKey;
    }

    runtime.selectedNodeKeys = remapSet(runtime.selectedNodeKeys);
    runtime.collapsedNodeKeys = remapSet(runtime.collapsedNodeKeys);
    runtime.lockedNodeKeys = remapSet(runtime.lockedNodeKeys);
  }

  function setSelection(editorIds: string[], options: { primaryId?: string | null; render?: boolean } = {}) {
    const { primaryId = null, render = true } = options;
    const validIds = [...new Set(
      editorIds
        .filter((editorId) => runtime.nodeMap.has(editorId))
        .map((editorId) => model.resolveSelectionEditorId?.(editorId) || editorId)
        .filter((editorId): editorId is string => Boolean(editorId))
        .filter((editorId) => runtime.nodeMap.has(editorId))
    )];
    const resolvedPrimaryId = primaryId && runtime.nodeMap.has(primaryId)
      ? (model.resolveSelectionEditorId?.(primaryId) || primaryId)
      : primaryId;
    const nextPrimaryId = resolvedPrimaryId && validIds.includes(resolvedPrimaryId)
      ? resolvedPrimaryId
      : (validIds[0] || null);
    const selectedNodeKey = nextPrimaryId
      ? model.getNodeKeyByEditorId(nextPrimaryId)
      : null;
    const selectedNodeKeys = validIds
      .map((editorId) => model.getNodeKeyByEditorId(editorId))
      .filter((nodeKey): nodeKey is string => Boolean(nodeKey));

    store.selection.setSelection(validIds, nextPrimaryId, selectedNodeKey, selectedNodeKeys);

    if (render) {
      refreshSelectionState();
    }
  }

  function resolveLiveSelection(fallbackEditorId = runtime.svgRoot?.dataset.editorId || null) {
    const resolvedEditorIds = [...runtime.selectedNodeKeys]
      .map((nodeKey) => model.getEditorIdByNodeKey(nodeKey))
      .filter((editorId): editorId is string => Boolean(editorId));
    const resolvedEditorId = runtime.selectedNodeKey
      ? model.getEditorIdByNodeKey(runtime.selectedNodeKey)
      : null;
    const fallbackIds = resolvedEditorIds.length
      ? resolvedEditorIds
      : (fallbackEditorId ? [fallbackEditorId] : []);

    setSelection(fallbackIds, {
      primaryId: resolvedEditorId || fallbackIds[0] || null,
      render: false
    });
  }

  function getSelectedEditorIds(): string[] {
    return [...runtime.selectedIds].filter((editorId) => runtime.nodeMap.has(editorId));
  }

  function clearSelection(options = {}) {
    setSelection([], options);
  }

  function selectNode(editorId: string | null, options: { render?: boolean } = {}) {
    setSelection(editorId ? [editorId] : [], {
      primaryId: editorId || null,
      render: options.render !== false
    });
  }

  function toggleNodeCollapse(editorId: string) {
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!nodeKey) {
      return;
    }

    if (runtime.collapsedNodeKeys.has(nodeKey)) {
      runtime.collapsedNodeKeys.delete(nodeKey);
    } else {
      runtime.collapsedNodeKeys.add(nodeKey);
    }

    renderer.refresh({ tree: true });
  }

  function toggleNodeLock(editorId: string) {
    const node = runtime.nodeMap.get(editorId);
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!node || !nodeKey || node === runtime.svgRoot) {
      return;
    }

    if (runtime.lockedNodeKeys.has(nodeKey)) {
      runtime.lockedNodeKeys.delete(nodeKey);
    } else {
      runtime.lockedNodeKeys.add(nodeKey);
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
      .map((editorId) => runtime.nodeMap.get(editorId))
      .filter((node): node is EditorSvgElement => Boolean(node && node !== runtime.svgRoot && node.parentNode))
      .filter((node) => {
        let parent = node.parentElement;
        while (parent) {
          const parentEditorId = parent.dataset?.editorId;
          if (parentEditorId && selectedIds.has(parentEditorId)) {
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
    remapMetadataKeys,
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
