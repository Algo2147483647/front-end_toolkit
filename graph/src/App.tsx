import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildStageData } from "./layout/stage-layout";
import { applyGraphCommand, type GraphCommand } from "./graph/commands";
import { createInitialCanvasDag, INITIAL_CANVAS_FILE_NAME } from "./graph/initialCanvas";
import { normalizeDagInput } from "./graph/normalize";
import { getFullGraphSelection, getInitialSelection, getParentLevelSelection, sanitizeNodeLabel } from "./graph/selectors";
import { serializeDag } from "./graph/serialize";
import { copyTextToClipboard } from "./adapters/clipboard";
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
import { saveGraphPagePreferences } from "./state/preferences";
import ConsoleSidebar from "./components/ConsoleSidebar";
import ContextMenu, { type ContextMenuAction } from "./components/ContextMenu";
import NodeDetailModal from "./components/NodeDetailModal";
import RelationEditorModal from "./components/RelationEditorModal";
import SaveJsonModal from "./components/SaveJsonModal";
import Topbar from "./components/Topbar";
import Workspace from "./components/Workspace";
import type { GraphLayoutMode, GraphMode, NodeKey } from "./graph/types";
import { getGraphLayoutLabel } from "./graph/types";
import type { EditTransaction } from "./state/initialState";
import { collectBatchEffects, buildConsoleMutationLabel, executeConsoleInstructions } from "./console/executor";
import { parseConsoleSource } from "./console/dsl";
import { CONSOLE_COMMAND_REFERENCE } from "./console/reference";

export default function App() {
  const [state, dispatch] = useReducer(graphReducer, initialGraphAppState);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleContextNodeKey, setConsoleContextNodeKey] = useState<NodeKey | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<Array<{ id: number; tone: "input" | "success" | "error" | "info"; text: string }>>([
    { id: 1, tone: "info", text: "Graph console ready." },
  ]);
  const [consoleHistory, setConsoleHistory] = useState<string[]>([]);
  const [consoleHistoryIndex, setConsoleHistoryIndex] = useState<number | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [nodeDetailInitialFocus, setNodeDetailInitialFocus] = useState<"fields" | "raw">("fields");
  const suppressDefaultGraphRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const topbarRef = useRef<HTMLElement>(null);

  useDefaultGraph(dispatch, suppressDefaultGraphRef);

  useEffect(() => {
    saveGraphPagePreferences({
      mode: state.mode,
      layoutMode: state.layout.mode,
      consoleSidebarOpen: state.ui.consoleSidebarOpen,
      consoleSidebarWidth: state.ui.consoleSidebarWidth,
    });
  }, [state.layout.mode, state.mode, state.ui.consoleSidebarOpen, state.ui.consoleSidebarWidth]);

  useEffect(() => {
    if (consoleContextNodeKey && state.dag && !state.dag[consoleContextNodeKey]) {
      setConsoleContextNodeKey(null);
    }
  }, [consoleContextNodeKey, state.dag]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [consoleInput]);

  const stage = useMemo(() => state.dag ? buildStageData({ dag: state.dag, selection: state.selection, layoutMode: state.layout.mode }) : null, [state.dag, state.layout.mode, state.selection]);
  const parentSelection = useMemo(() => state.dag && stage ? getParentLevelSelection(state.dag, stage.topLevelKeys) : null, [stage, state.dag]);
  const consoleSidebarVisible = state.mode === "edit" && state.ui.consoleSidebarOpen;
  const consoleSuggestions = useMemo(() => getConsoleSuggestions(consoleInput), [consoleInput]);
  const status = useMemo(() => {
    if (!state.dag || !stage) {
      return state.ui.status;
    }
    const focusNode = stage.dag[stage.root];
    const focusLabel = focusNode?.synthetic ? focusNode.label || "Selected roots" : sanitizeNodeLabel(focusNode?.label || focusNode?.title || focusNode?.name || stage.root);
    const modeLabel = state.mode === "edit" ? "Edit" : "Preview";
    const layoutLabel = getGraphLayoutLabel(state.layout.mode);
    const warningText = stage.warnings.length ? ` ${stage.warnings[0]}` : "";
    return state.ui.status
      && !state.ui.status.includes("loaded from")
      && !state.ui.status.startsWith("Mode:")
      && !state.ui.status.startsWith("Layout:")
      ? state.ui.status
      : `${modeLabel} mode. ${layoutLabel} layout. Focused on ${focusLabel}. ${stage.nodes.length} nodes and ${stage.edges.length} links are visible.${warningText}`;
  }, [stage, state.dag, state.layout.mode, state.mode, state.ui.status]);

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
    onUndo: () => {
      if (state.mode === "edit" && state.editHistory.undoStack.length > 0) {
        dispatch({ type: "undoRequested" });
      }
    },
    onRedo: () => {
      if (state.mode === "edit" && state.editHistory.redoStack.length > 0) {
        dispatch({ type: "redoRequested" });
      }
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
      const transaction: EditTransaction = {
        label: result.message || "Updated graph.",
        beforeDag: state.dag,
        afterDag: result.dag,
        beforeSelection: state.selection,
        afterSelection: selection,
        beforeNavigationHistory: state.history,
        afterNavigationHistory: history,
        revisionBefore: state.editHistory.revision,
        revisionAfter: state.editHistory.revision + 1,
      };
      dispatch({ type: "graphCommandCommitted", result, transaction });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The graph command failed.";
      dispatch({ type: "statusChanged", status: message });
      window.alert(message);
    }
  }, [state]);

  const handleConsoleRun = useCallback(() => {
    const source = consoleInput.trim();
    if (!source) {
      return;
    }

    appendConsoleEntry(setConsoleEntries, "input", `${buildConsolePrompt(consoleContextNodeKey)} ${source}`);
    setConsoleHistory((current) => (current[current.length - 1] === source ? current : [...current, source]));
    setConsoleHistoryIndex(null);
    setConsoleInput("");

    if (source === "clear" || source === "cls") {
      setConsoleEntries([{ id: Date.now(), tone: "info", text: "Console cleared." }]);
      return;
    }

    const parsed = parseConsoleSource(source);
    if (!parsed.ok) {
      appendConsoleEntry(setConsoleEntries, "error", `Line ${parsed.error.line}: ${parsed.error.message}`);
      return;
    }
    if (!parsed.instructions.length) {
      appendConsoleEntry(setConsoleEntries, "info", "No instructions were found.");
      return;
    }
    if (!state.dag && !parsed.instructions.every((instruction) => instruction.type === "help")) {
      appendConsoleEntry(setConsoleEntries, "error", "No graph loaded. Load or initialize a graph before running console instructions.");
      return;
    }

    const executed = executeConsoleInstructions(state.dag || {}, parsed.instructions, consoleContextNodeKey);
    if (!executed.ok) {
      setConsoleContextNodeKey(executed.contextNodeKey);
      appendConsoleEntry(
        setConsoleEntries,
        "error",
        executed.message.startsWith("Line ") ? executed.message : `Line ${executed.line}: ${executed.message}`,
      );
      return;
    }

    setConsoleContextNodeKey(executed.contextNodeKey);
    executed.outputMessages.forEach((message) => appendConsoleEntry(setConsoleEntries, "info", message));

    if (executed.mutationCount > 0) {
      const beforeDag = state.dag;
      if (!beforeDag) {
        appendConsoleEntry(setConsoleEntries, "error", "No graph loaded. Load or initialize a graph before running console instructions.");
        return;
      }
      let nextSelection = state.selection;
      let nextHistory = state.history;
      executed.results.forEach((result) => {
        nextSelection = repairSelectionAfterCommand(result.dag, nextSelection, nextSelection, result);
        nextHistory = repairHistoryAfterCommand({ ...state, history: nextHistory } as typeof state, result);
      });

      const transaction: EditTransaction = {
        label: buildConsoleMutationLabel(executed.mutationCount, executed.results[executed.results.length - 1]?.message),
        beforeDag,
        afterDag: executed.dag,
        beforeSelection: state.selection,
        afterSelection: nextSelection,
        beforeNavigationHistory: state.history,
        afterNavigationHistory: nextHistory,
        revisionBefore: state.editHistory.revision,
        revisionAfter: state.editHistory.revision + 1,
      };
      const batchEffects = collectBatchEffects(executed.results);
      dispatch({
        type: "graphCommandsCommitted",
        transaction,
        renamedKeys: batchEffects.renamedKeys,
        deletedKeys: batchEffects.deletedKeys,
        status: buildConsoleMutationLabel(executed.mutationCount, executed.results[executed.results.length - 1]?.message),
      });
    }

    const finalUiEffect = executed.uiEffects.filter((effect) => effect.nodeKey).at(-1);
    if (finalUiEffect) {
      setNodeDetailInitialFocus(finalUiEffect.type === "json" ? "raw" : "fields");
      dispatch({ type: "nodeDetailOpened", nodeKey: finalUiEffect.nodeKey });
    }

    appendConsoleEntry(
      setConsoleEntries,
      "success",
      buildConsoleSuccessMessage(executed.instructionCount, executed.mutationCount, executed.contextNodeKey, finalUiEffect?.type),
    );
  }, [consoleContextNodeKey, consoleInput, state]);

  const handleConsoleSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = state.ui.consoleSidebarWidth;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      dispatch({ type: "consoleSidebarWidthChanged", width: startWidth + (pointerEvent.clientX - startX) });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [state.ui.consoleSidebarWidth]);

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
    suppressDefaultGraphRef.current = true;
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

  function initializeCanvas() {
    suppressDefaultGraphRef.current = true;
    const dag = createInitialCanvasDag();
    dispatch({
      type: "canvasInitialized",
      dag,
      fileName: INITIAL_CANVAS_FILE_NAME,
      selection: getInitialSelection(dag),
      status: "Initialized a new canvas with one starting node. Edit mode enabled.",
    });
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
    const menuHeight = 368;
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
    if (action === "copy-key" && nodeKey) {
      void handleCopyNodeKey(nodeKey);
      return;
    }
    if (action === "rename-node" && nodeKey) {
      promptRenameNode(nodeKey);
      return;
    }
    if (action === "delete-node" && nodeKey) {
      commitCommand({ type: "deleteNode", key: nodeKey });
      return;
    }
    if (action === "delete-subtree" && nodeKey && state.dag) {
      commitCommand({ type: "deleteSubtree", rootKey: nodeKey });
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
      return;
    }
    if (action === "copy-node" && nodeKey) {
      promptCopyNode(nodeKey);
    }
  }

  async function handleCopyNodeKey(nodeKey: NodeKey) {
    try {
      await copyTextToClipboard(nodeKey);
      dispatch({ type: "statusChanged", status: `Copied node key "${nodeKey}" to the clipboard.` });
    } catch (error) {
      console.error(error);
      dispatch({ type: "statusChanged", status: `Unable to copy node key "${nodeKey}".` });
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
    commitCommand({ type: "addNode", key: newKey, parentKey: referenceNodeKey || undefined });
  }

  function promptCopyNode(sourceNodeKey: NodeKey) {
    const input = window.prompt("Enter a new unique node key:", `${sourceNodeKey}_Copy`);
    if (input === null) {
      return;
    }
    const newKey = input.trim();
    commitCommand({ type: "copyNode", sourceKey: sourceNodeKey, key: newKey, parentKey: sourceNodeKey });
  }

  function handleModeChange(mode: GraphMode) {
    dispatch({ type: "modeChanged", mode });
  }

  function handleLayoutModeChange(mode: GraphLayoutMode) {
    dispatch({ type: "layoutModeChanged", mode });
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
        layoutMode={state.layout.mode}
        status={status}
        fileName={state.source.fileName}
        hasGraph={Boolean(stage)}
        canBack={state.history.length > 0}
        canUp={Boolean(parentSelection)}
        canUndo={state.mode === "edit" && state.editHistory.undoStack.length > 0}
        canRedo={state.mode === "edit" && state.editHistory.redoStack.length > 0}
        zoomPercent={Math.round(state.zoom.scale * 100)}
        canZoomOut={Boolean(stage) && state.zoom.scale > state.zoom.minScale + 0.001}
        canZoomIn={Boolean(stage) && state.zoom.scale < state.zoom.maxScale - 0.001}
        settingsOpen={state.ui.settingsOpen}
        consoleSidebarOpen={consoleSidebarVisible}
        onBack={() => dispatch({ type: "navigateBack" })}
        onUp={() => parentSelection && dispatch({ type: "selectionChanged", selection: parentSelection, pushHistory: true })}
        onAll={() => dispatch({ type: "selectionChanged", selection: getFullGraphSelection(), pushHistory: true })}
        onUndo={() => dispatch({ type: "undoRequested" })}
        onRedo={() => dispatch({ type: "redoRequested" })}
        onZoomOut={zoom.zoomOut}
        onZoomIn={zoom.zoomIn}
        onZoomFit={zoom.zoomFit}
        onZoomPercentCommit={(percent) => zoom.setZoomPercent(percent)}
        onSettingsToggle={() => dispatch({ type: "settingsToggled" })}
        onConsoleSidebarToggle={() => dispatch({ type: "consoleSidebarToggled" })}
        onModeChange={handleModeChange}
        onLayoutModeChange={handleLayoutModeChange}
        onFileInputClick={handleFileInputClick}
        onFileInputChange={handleFileInputChange}
        onInitializeCanvas={initializeCanvas}
        onExport={handleExportSvg}
        onSaveJson={() => state.dag ? dispatch({ type: "saveDialogOpened" }) : dispatch({ type: "statusChanged", status: "Load or render a graph before saving JSON." })}
      />

      <Workspace
        containerRef={containerRef}
        svgRef={svgRef}
        stage={stage}
        status={status}
        sidebar={(
          <ConsoleSidebar
            mode={state.mode}
            hasGraph={Boolean(state.dag)}
            entries={consoleEntries}
            inputValue={consoleInput}
            contextNodeKey={consoleContextNodeKey}
            suggestions={consoleSuggestions}
            activeSuggestionIndex={activeSuggestionIndex}
            onInputChange={(value) => {
              setConsoleInput(value);
              setConsoleHistoryIndex(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleConsoleRun();
                return;
              }
              if (event.key === "Tab" && consoleSuggestions.length > 0) {
                event.preventDefault();
                setConsoleInput(consoleSuggestions[activeSuggestionIndex]?.insertText || consoleInput);
                return;
              }
              if (consoleSuggestions.length > 0 && event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSuggestionIndex((current) => (current + 1) % consoleSuggestions.length);
                return;
              }
              if (consoleSuggestions.length > 0 && event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSuggestionIndex((current) => (current - 1 + consoleSuggestions.length) % consoleSuggestions.length);
                return;
              }
              if (!consoleSuggestions.length && event.key === "ArrowUp" && consoleHistory.length > 0) {
                event.preventDefault();
                setConsoleHistoryIndex((current) => {
                  const next = current === null ? consoleHistory.length - 1 : Math.max(0, current - 1);
                  setConsoleInput(consoleHistory[next] || "");
                  return next;
                });
                return;
              }
              if (!consoleSuggestions.length && event.key === "ArrowDown" && consoleHistory.length > 0) {
                event.preventDefault();
                setConsoleHistoryIndex((current) => {
                  if (current === null) {
                    return null;
                  }
                  const next = current + 1;
                  if (next >= consoleHistory.length) {
                    setConsoleInput("");
                    return null;
                  }
                  setConsoleInput(consoleHistory[next] || "");
                  return next;
                });
              }
            }}
            onSuggestionSelect={(suggestion) => setConsoleInput(suggestion.insertText)}
          />
        )}
        sidebarOpen={consoleSidebarVisible}
        sidebarWidth={state.ui.consoleSidebarWidth}
        onInitializeCanvas={initializeCanvas}
        hoveredKey={hoveredKey}
        focusedKey={focusedKey}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onHoverChange={setHoveredKey}
        onFocusChange={setFocusedKey}
        onScroll={() => dispatch({ type: "contextMenuClosed" })}
        onSidebarResizeStart={handleConsoleSidebarResizeStart}
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
        initialFocus={nodeDetailInitialFocus}
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

function buildConsoleSuccessMessage(
  instructionCount: number,
  mutationCount: number,
  contextNodeKey: NodeKey | null,
  uiEffectType: "show" | "json" | undefined,
): string {
  const parts = [`${instructionCount} instruction${instructionCount === 1 ? "" : "s"} executed`];
  if (mutationCount > 0) {
    parts.push(`${mutationCount} mutation${mutationCount === 1 ? "" : "s"} committed`);
  }
  if (uiEffectType === "show") {
    parts.push("node viewer opened");
  } else if (uiEffectType === "json") {
    parts.push("raw JSON editor opened");
  }
  parts.push(`context=${contextNodeKey || "unset"}`);
  return `${parts.join(", ")}.`;
}

function appendConsoleEntry(
  setEntries: React.Dispatch<React.SetStateAction<Array<{ id: number; tone: "input" | "success" | "error" | "info"; text: string }>>>,
  tone: "input" | "success" | "error" | "info",
  text: string,
): void {
  setEntries((current) => [...current, { id: Date.now() + current.length, tone, text }]);
}

function buildConsolePrompt(contextNodeKey: NodeKey | null): string {
  return contextNodeKey ? `${contextNodeKey}>` : "graph>";
}

interface ConsoleSuggestion {
  label: string;
  insertText: string;
}

const COMMAND_TEMPLATES: ConsoleSuggestion[] = [
  ...CONSOLE_COMMAND_REFERENCE.map((command) => ({ label: command.label, insertText: command.insertText })),
];

function getConsoleSuggestions(input: string): ConsoleSuggestion[] {
  const trimmedStart = input.trimStart();
  if (!trimmedStart) {
    return [];
  }

  const hasWhitespace = /\s/.test(trimmedStart);
  if (!hasWhitespace) {
    const lower = trimmedStart.toLowerCase();
    return COMMAND_TEMPLATES.filter((item) => item.label.toLowerCase().startsWith(lower)).slice(0, 8);
  }

  const mnemonic = trimmedStart.split(/\s+/, 1)[0]?.toLowerCase() || "";
  return COMMAND_TEMPLATES.filter((item) => item.label.toLowerCase().startsWith(`${mnemonic} `) || item.label.toLowerCase() === mnemonic).slice(0, 6);
}
