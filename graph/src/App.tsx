import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import { buildStageData } from "./layout/stage-layout";
import { applyGraphCommand, type GraphCommand } from "./graph/commands";
import { normalizeDagInput } from "./graph/normalize";
import { getFullGraphSelection, getInitialSelection, getParentLevelSelection, sanitizeNodeLabel } from "./graph/selectors";
import { serializeDag } from "./graph/serialize";
import { buildTimestampFileName, downloadJsonFile, ensureJsonExtension } from "./adapters/download";
import { canOverwrite, openJsonFileWithAccess, readJsonFile, requestWritablePermission, writeJsonToHandle } from "./adapters/fileAccess";
import { downloadSvg } from "./rendering/export-svg";
import { useDefaultGraph } from "./hooks/useDefaultGraph";
import { useGraphPan } from "./hooks/useGraphPan";
import { useGraphZoom } from "./hooks/useGraphZoom";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useOutsideDismiss } from "./hooks/useOutsideDismiss";
import { useResizeObserver } from "./hooks/useResizeObserver";
import { repairSelectionAfterCommand } from "./state/derived";
import { graphReducer, repairHistoryAfterCommand } from "./state/graphReducer";
import { initialGraphAppState } from "./state/initialState";
import ContextMenu, { type ContextMenuAction } from "./components/ContextMenu";
import NodeDetailModal from "./components/NodeDetailModal";
import RelationEditorModal from "./components/RelationEditorModal";
import SaveJsonModal from "./components/SaveJsonModal";
import Topbar from "./components/Topbar";
import Workspace from "./components/Workspace";
import type { GraphMode, NodeKey } from "./graph/types";

export default function App() {
  const [state, dispatch] = useReducer(graphReducer, initialGraphAppState);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const topbarRef = useRef<HTMLElement>(null);

  useDefaultGraph(dispatch);

  const stage = useMemo(() => state.dag ? buildStageData({ dag: state.dag, selection: state.selection }) : null, [state.dag, state.selection]);
  const parentSelection = useMemo(() => state.dag && stage ? getParentLevelSelection(state.dag, stage.topLevelKeys) : null, [stage, state.dag]);
  const status = useMemo(() => {
    if (!state.dag || !stage) {
      return state.ui.status;
    }
    const focusNode = stage.dag[stage.root];
    const focusLabel = focusNode?.synthetic ? focusNode.label || "Selected roots" : sanitizeNodeLabel(focusNode?.label || focusNode?.title || focusNode?.name || stage.root);
    const modeLabel = state.mode === "edit" ? "Edit" : "Preview";
    return state.ui.status && !state.ui.status.includes("loaded from") && !state.ui.status.startsWith("Mode:")
      ? state.ui.status
      : `${modeLabel} mode. Focused on ${focusLabel}. ${stage.nodes.length} nodes and ${stage.edges.length} links are visible.`;
  }, [stage, state.dag, state.mode, state.ui.status]);

  const handleZoomChange = useCallback((scale: number, minScale?: number) => {
    dispatch({ type: "zoomChanged", scale, minScale });
  }, []);

  const zoom = useGraphZoom({
    containerRef,
    svgRef,
    topbarRef,
    stage,
    scale: state.zoom.scale,
    minScale: state.zoom.minScale,
    maxScale: state.zoom.maxScale,
    onZoomChange: handleZoomChange,
  });

  const handleResize = useCallback(() => zoom.refresh(true), [zoom]);
  useResizeObserver(containerRef, handleResize);
  useGraphPan({ containerRef, enabled: Boolean(stage), onPanStart: () => dispatch({ type: "contextMenuClosed" }) });

  useOutsideDismiss(Boolean(state.ui.contextMenu), () => dispatch({ type: "contextMenuClosed" }));
  useKeyboardShortcuts({
    onEscape: () => {
      dispatch({ type: "contextMenuClosed" });
      dispatch({ type: "modalClosed" });
    },
  });

  const commitCommand = useCallback((command: GraphCommand, preferredSelection = state.selection) => {
    if (!state.dag) {
      return;
    }
    try {
      const result = applyGraphCommand(state.dag, command);
      const selection = repairSelectionAfterCommand(result.dag, state.selection, preferredSelection, result);
      const history = repairHistoryAfterCommand(state, result);
      dispatch({ type: "graphCommandCommitted", result, selection, history });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The graph command failed.";
      dispatch({ type: "statusChanged", status: message });
      window.alert(message);
    }
  }, [state]);

  async function handleFileInputClick(event: React.MouseEvent<HTMLInputElement>) {
    if (typeof window.showOpenFilePicker !== "function") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      const pickedFile = await openJsonFileWithAccess();
      if (pickedFile) {
        await loadFile(pickedFile.file, pickedFile.handle);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error(error);
      dispatch({ type: "statusChanged", status: "The selected file could not be opened as JSON." });
    }
  }

  async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await loadFile(file, null);
    event.target.value = "";
  }

  async function loadFile(file: File, fileHandle: FileSystemFileHandle | null) {
    try {
      const payload = await readJsonFile(file);
      const dag = normalizeDagInput(payload);
      dispatch({
        type: "graphLoaded",
        dag,
        fileName: file.name,
        fileHandle,
        selection: getInitialSelection(dag),
        status: `${Object.keys(dag).length} nodes loaded from ${file.name}.`,
      });
    } catch (error) {
      console.error(error);
      dispatch({ type: "statusChanged", status: "The selected file could not be parsed as JSON." });
    }
  }

  function handleNodeClick(nodeKey: string) {
    if (!state.selection || state.selection.type !== "node" || state.selection.key !== nodeKey) {
      dispatch({ type: "selectionChanged", selection: { type: "node", key: nodeKey }, pushHistory: true });
    }
  }

  function handleNodeContextMenu(event: React.MouseEvent<SVGGElement>, nodeKey: string) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 190;
    const menuHeight = 294;
    dispatch({
      type: "contextMenuOpened",
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
      nodeKey,
    });
  }

  function handleContextMenuAction(action: ContextMenuAction, nodeKey: NodeKey | null) {
    dispatch({ type: "contextMenuClosed" });
    if (action === "view-node" && nodeKey) {
      dispatch({ type: "nodeDetailOpened", nodeKey });
      return;
    }
    if (action === "rename-node" && nodeKey) {
      promptRenameNode(nodeKey);
      return;
    }
    if (action === "delete-node" && nodeKey) {
      if (window.confirm(`Delete node "${nodeKey}" and remove all related parent/child references?`)) {
        commitCommand({ type: "deleteNode", key: nodeKey });
      }
      return;
    }
    if (action === "delete-subtree" && nodeKey && state.dag) {
      if (window.confirm(`Delete subtree rooted at "${nodeKey}"?`)) {
        commitCommand({ type: "deleteSubtree", rootKey: nodeKey });
      }
      return;
    }
    if (action === "edit-parents" && nodeKey) {
      dispatch({ type: "relationEditorOpened", nodeKey, field: "parents" });
      return;
    }
    if (action === "edit-children" && nodeKey) {
      dispatch({ type: "relationEditorOpened", nodeKey, field: "children" });
      return;
    }
    if (action === "add-node") {
      promptAddNode(nodeKey);
    }
  }

  function promptRenameNode(nodeKey: NodeKey) {
    const input = window.prompt("Enter a new unique node key:", nodeKey);
    if (input === null) {
      return;
    }
    commitCommand({ type: "renameNode", oldKey: nodeKey, newKey: input.trim() });
  }

  function promptAddNode(referenceNodeKey: NodeKey | null) {
    const input = window.prompt("Enter a new unique node key:", "New_Node");
    if (input === null) {
      return;
    }
    const newKey = input.trim();
    const shouldLink = referenceNodeKey ? window.confirm(`Link "${newKey}" as a child of "${referenceNodeKey}"?`) : false;
    commitCommand({ type: "addNode", key: newKey, parentKey: shouldLink ? referenceNodeKey || undefined : undefined });
  }

  function handleModeChange(mode: GraphMode) {
    dispatch({ type: "modeChanged", mode });
  }

  function handleExportSvg() {
    if (!svgRef.current) {
      dispatch({ type: "statusChanged", status: "Render a DAG first, then export the SVG." });
      return;
    }
    downloadSvg(svgRef.current);
    dispatch({ type: "statusChanged", status: "Exported current view as dag-graph.svg." });
  }

  function getCurrentJsonContent(): string {
    return JSON.stringify(serializeDag(state.dag || {}), null, 2);
  }

  async function handleOverwriteJson() {
    if (!state.source.fileHandle || !canOverwrite(state.source.fileHandle)) {
      dispatch({ type: "statusChanged", status: "Direct overwrite is unavailable. Reopen the JSON with file access, or save a new copy." });
      return;
    }
    const sourceFileName = ensureJsonExtension(state.source.fileName || state.source.fileHandle.name || "graph.json");
    if (!window.confirm(`Overwrite "${sourceFileName}" on disk?`)) {
      dispatch({ type: "statusChanged", status: "Save cancelled." });
      return;
    }
    try {
      const granted = await requestWritablePermission(state.source.fileHandle);
      if (!granted) {
        dispatch({ type: "statusChanged", status: "Write permission was not granted for the source JSON file." });
        return;
      }
      await writeJsonToHandle(state.source.fileHandle, getCurrentJsonContent());
      dispatch({ type: "saved", status: `Saved JSON to ${sourceFileName}.` });
    } catch (error) {
      console.error(error);
      dispatch({ type: "statusChanged", status: `Unable to overwrite ${sourceFileName}.` });
    }
  }

  function handleSaveJsonAsNew() {
    const outputFileName = buildTimestampFileName(state.source.fileName || "graph.json");
    downloadJsonFile(getCurrentJsonContent(), outputFileName);
    dispatch({ type: "saved", status: `Saved JSON as ${outputFileName}.` });
  }

  const relationEditor = state.ui.relationEditor;
  const detailNodeKey = state.ui.nodeDetail?.nodeKey || null;

  return (
    <div className="app-shell">
      <Topbar
        topbarRef={topbarRef}
        mode={state.mode}
        status={status}
        fileName={state.source.fileName}
        hasGraph={Boolean(stage)}
        canBack={state.history.length > 0}
        canUp={Boolean(parentSelection)}
        zoomPercent={Math.round(state.zoom.scale * 100)}
        canZoomOut={Boolean(stage) && state.zoom.scale > state.zoom.minScale + 0.001}
        canZoomIn={Boolean(stage) && state.zoom.scale < state.zoom.maxScale - 0.001}
        settingsOpen={state.ui.settingsOpen}
        onBack={() => dispatch({ type: "navigateBack" })}
        onUp={() => parentSelection && dispatch({ type: "selectionChanged", selection: parentSelection, pushHistory: true })}
        onAll={() => dispatch({ type: "selectionChanged", selection: getFullGraphSelection(), pushHistory: true })}
        onZoomOut={zoom.zoomOut}
        onZoomIn={zoom.zoomIn}
        onZoomFit={zoom.zoomFit}
        onZoomPercentCommit={(percent) => zoom.setZoomPercent(percent)}
        onSettingsToggle={() => dispatch({ type: "settingsToggled" })}
        onModeChange={handleModeChange}
        onFileInputClick={handleFileInputClick}
        onFileInputChange={handleFileInputChange}
        onExport={handleExportSvg}
        onSaveJson={() => state.dag ? dispatch({ type: "saveDialogOpened" }) : dispatch({ type: "statusChanged", status: "Load or render a graph before saving JSON." })}
      />

      <Workspace
        containerRef={containerRef}
        svgRef={svgRef}
        stage={stage}
        status={status}
        hoveredKey={hoveredKey}
        focusedKey={focusedKey}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onHoverChange={setHoveredKey}
        onFocusChange={setFocusedKey}
        onScroll={() => dispatch({ type: "contextMenuClosed" })}
      />

      <ContextMenu menu={state.ui.contextMenu} mode={state.mode} onAction={handleContextMenuAction} />
      <RelationEditorModal
        open={Boolean(relationEditor)}
        nodeKey={relationEditor?.nodeKey || null}
        field={relationEditor?.field || null}
        node={relationEditor && state.dag ? state.dag[relationEditor.nodeKey] || null : null}
        onSave={(keys) => {
          if (relationEditor) {
            commitCommand(relationEditor.field === "parents"
              ? { type: "setParents", key: relationEditor.nodeKey, parents: keys }
              : { type: "setChildren", key: relationEditor.nodeKey, children: keys });
            dispatch({ type: "modalClosed" });
          }
        }}
        onClose={() => dispatch({ type: "modalClosed" })}
      />
      <NodeDetailModal
        open={Boolean(detailNodeKey)}
        nodeKey={detailNodeKey}
        node={detailNodeKey && state.dag ? state.dag[detailNodeKey] || null : null}
        mode={state.mode}
        onSave={(nextKey, fields) => {
          if (detailNodeKey) {
            commitCommand({ type: "updateNodeFields", key: detailNodeKey, nextKey, fields });
          }
        }}
        onClose={() => dispatch({ type: "modalClosed" })}
      />
      <SaveJsonModal
        open={state.ui.saveDialogOpen}
        sourceFileName={state.source.fileName}
        canOverwrite={canOverwrite(state.source.fileHandle)}
        onOverwrite={handleOverwriteJson}
        onSaveNew={handleSaveJsonAsNew}
        onClose={() => dispatch({ type: "saveDialogClosed" })}
      />
    </div>
  );
}
