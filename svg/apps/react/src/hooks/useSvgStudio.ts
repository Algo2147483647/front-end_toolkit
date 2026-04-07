import { useEffect, useMemo, useRef } from "react";
import type { DragEventHandler, MouseEventHandler, PointerEventHandler, RefObject } from "react";
import { mountReactSvgStudio } from "@core/react/mount";
import type { SvgStudioUiRefs } from "@core/react/types";

function assertRef<T>(name: string, value: T | null): T {
  if (!value) {
    throw new Error(`Missing studio DOM ref: ${name}`);
  }

  return value;
}

export interface SvgStudioDomRefs {
  appShellRef: RefObject<HTMLDivElement>;
  topbarRef: RefObject<HTMLElement>;
  leftPanelRef: RefObject<HTMLElement>;
  rightPanelRef: RefObject<HTMLElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  imageInputRef: RefObject<HTMLInputElement>;
  importButtonRef: RefObject<HTMLButtonElement>;
  saveButtonRef: RefObject<HTMLButtonElement>;
  gridSnapButtonRef: RefObject<HTMLButtonElement>;
  gridSnapSizeGroupRef: RefObject<HTMLDivElement>;
  gridSnapSizeInputRef: RefObject<HTMLInputElement>;
  gridSnapSizeSelectRef: RefObject<HTMLSelectElement>;
  sourceToggleButtonRef: RefObject<HTMLButtonElement>;
  collapseTopbarButtonRef: RefObject<HTMLButtonElement>;
  showTopbarButtonRef: RefObject<HTMLButtonElement>;
  hideLeftPanelButtonRef: RefObject<HTMLButtonElement>;
  leftPanelInsertTabRef: RefObject<HTMLButtonElement>;
  leftPanelLayersTabRef: RefObject<HTMLButtonElement>;
  leftPanelInsertSectionRef: RefObject<HTMLElement>;
  leftPanelLayersSectionRef: RefObject<HTMLElement>;
  hideRightPanelButtonRef: RefObject<HTMLButtonElement>;
  floatingLeftButtonRef: RefObject<HTMLButtonElement>;
  floatingRightButtonRef: RefObject<HTMLButtonElement>;
  insertImageButtonRef: RefObject<HTMLButtonElement>;
  newDocumentButtonRef: RefObject<HTMLButtonElement>;
  applySourceButtonRef: RefObject<HTMLButtonElement>;
  exportButtonRef: RefObject<HTMLButtonElement>;
  undoButtonRef: RefObject<HTMLButtonElement>;
  redoButtonRef: RefObject<HTMLButtonElement>;
  duplicateButtonRef: RefObject<HTMLButtonElement>;
  deleteButtonRef: RefObject<HTMLButtonElement>;
  zoomOutButtonRef: RefObject<HTMLButtonElement>;
  zoomInButtonRef: RefObject<HTMLButtonElement>;
  zoomResetButtonRef: RefObject<HTMLButtonElement>;
  zoomLabelRef: RefObject<HTMLSpanElement>;
  statusPillRef: RefObject<HTMLSpanElement>;
  nodeCountBadgeRef: RefObject<HTMLSpanElement>;
  treePanelRef: RefObject<HTMLDivElement>;
  surfaceGridRef: RefObject<HTMLDivElement>;
  svgHostRef: RefObject<HTMLDivElement>;
  insertGridRef: RefObject<HTMLDivElement>;
  surfaceInnerRef: RefObject<HTMLDivElement>;
  workspaceSurfaceRef: RefObject<HTMLElement>;
  workspaceContentRef: RefObject<HTMLElement>;
  dropOverlayRef: RefObject<HTMLDivElement>;
  contextMenuRef: RefObject<HTMLDivElement>;
  bringToFrontButtonRef: RefObject<HTMLButtonElement>;
  sendToBackButtonRef: RefObject<HTMLButtonElement>;
  sourcePaneRef: RefObject<HTMLElement>;
  sourceEditorRef: RefObject<HTMLTextAreaElement>;
  propertyFormRef: RefObject<HTMLFormElement>;
  inspectorEmptyRef: RefObject<HTMLDivElement>;
}

interface MountedStudio {
  dispose?: () => void;
  editor: {
    onWindowDragEnd: () => void;
    onWindowDrop: () => void;
    onWindowKeyDown: (event: KeyboardEvent) => void;
    onWindowPointerCancel: () => void;
    onWindowPointerDown: (event: PointerEvent) => void;
    onWindowPointerMove: (event: PointerEvent) => void;
    onWindowPointerUp: () => void;
    onWindowResize: () => void;
    onWorkspaceContextMenu: (event: MouseEvent) => void;
    onWorkspaceDragEnter: (event: DragEvent) => void;
    onWorkspaceDragLeave: (event: DragEvent) => void;
    onWorkspaceDragOver: (event: DragEvent) => void;
    onWorkspaceDrop: (event: DragEvent) => Promise<void> | void;
    onWorkspacePointerDown: (event: PointerEvent) => void;
  };
}

export interface SvgStudioBindings {
  refs: SvgStudioDomRefs;
  workspaceSurfaceProps: {
    onContextMenu: MouseEventHandler<HTMLElement>;
    onDragEnter: DragEventHandler<HTMLElement>;
    onDragLeave: DragEventHandler<HTMLElement>;
    onDragOver: DragEventHandler<HTMLElement>;
    onDrop: DragEventHandler<HTMLElement>;
    onPointerDown: PointerEventHandler<HTMLElement>;
  };
}

function toUiRefs(refs: SvgStudioDomRefs): SvgStudioUiRefs {
  return {
    appShell: assertRef("appShell", refs.appShellRef.current),
    topbar: assertRef("topbar", refs.topbarRef.current),
    leftPanel: assertRef("leftPanel", refs.leftPanelRef.current),
    rightPanel: assertRef("rightPanel", refs.rightPanelRef.current),
    fileInput: assertRef("fileInput", refs.fileInputRef.current),
    imageInput: assertRef("imageInput", refs.imageInputRef.current),
    importButton: assertRef("importButton", refs.importButtonRef.current),
    saveButton: assertRef("saveButton", refs.saveButtonRef.current),
    gridSnapButton: assertRef("gridSnapButton", refs.gridSnapButtonRef.current),
    gridSnapSizeGroup: assertRef("gridSnapSizeGroup", refs.gridSnapSizeGroupRef.current),
    gridSnapSizeInput: assertRef("gridSnapSizeInput", refs.gridSnapSizeInputRef.current),
    gridSnapSizeSelect: assertRef("gridSnapSizeSelect", refs.gridSnapSizeSelectRef.current),
    sourceToggleButton: assertRef("sourceToggleButton", refs.sourceToggleButtonRef.current),
    collapseTopbarButton: assertRef("collapseTopbarButton", refs.collapseTopbarButtonRef.current),
    showTopbarButton: assertRef("showTopbarButton", refs.showTopbarButtonRef.current),
    hideLeftPanelButton: assertRef("hideLeftPanelButton", refs.hideLeftPanelButtonRef.current),
    leftPanelInsertTab: assertRef("leftPanelInsertTab", refs.leftPanelInsertTabRef.current),
    leftPanelLayersTab: assertRef("leftPanelLayersTab", refs.leftPanelLayersTabRef.current),
    leftPanelInsertSection: assertRef("leftPanelInsertSection", refs.leftPanelInsertSectionRef.current),
    leftPanelLayersSection: assertRef("leftPanelLayersSection", refs.leftPanelLayersSectionRef.current),
    hideRightPanelButton: assertRef("hideRightPanelButton", refs.hideRightPanelButtonRef.current),
    floatingLeftButton: assertRef("floatingLeftButton", refs.floatingLeftButtonRef.current),
    floatingRightButton: assertRef("floatingRightButton", refs.floatingRightButtonRef.current),
    insertImageButton: assertRef("insertImageButton", refs.insertImageButtonRef.current),
    newDocumentButton: assertRef("newDocumentButton", refs.newDocumentButtonRef.current),
    applySourceButton: assertRef("applySourceButton", refs.applySourceButtonRef.current),
    exportButton: assertRef("exportButton", refs.exportButtonRef.current),
    undoButton: assertRef("undoButton", refs.undoButtonRef.current),
    redoButton: assertRef("redoButton", refs.redoButtonRef.current),
    duplicateButton: assertRef("duplicateButton", refs.duplicateButtonRef.current),
    deleteButton: assertRef("deleteButton", refs.deleteButtonRef.current),
    zoomOutButton: assertRef("zoomOutButton", refs.zoomOutButtonRef.current),
    zoomInButton: assertRef("zoomInButton", refs.zoomInButtonRef.current),
    zoomResetButton: assertRef("zoomResetButton", refs.zoomResetButtonRef.current),
    zoomLabel: assertRef("zoomLabel", refs.zoomLabelRef.current),
    statusPill: assertRef("statusPill", refs.statusPillRef.current),
    nodeCountBadge: assertRef("nodeCountBadge", refs.nodeCountBadgeRef.current),
    treePanel: assertRef("treePanel", refs.treePanelRef.current),
    surfaceGrid: assertRef("surfaceGrid", refs.surfaceGridRef.current),
    svgHost: assertRef("svgHost", refs.svgHostRef.current),
    insertGrid: assertRef("insertGrid", refs.insertGridRef.current),
    surfaceInner: assertRef("surfaceInner", refs.surfaceInnerRef.current),
    workspaceSurface: assertRef("workspaceSurface", refs.workspaceSurfaceRef.current),
    workspaceContent: assertRef("workspaceContent", refs.workspaceContentRef.current),
    dropOverlay: assertRef("dropOverlay", refs.dropOverlayRef.current),
    contextMenu: assertRef("contextMenu", refs.contextMenuRef.current),
    bringToFrontButton: assertRef("bringToFrontButton", refs.bringToFrontButtonRef.current),
    sendToBackButton: assertRef("sendToBackButton", refs.sendToBackButtonRef.current),
    sourcePane: assertRef("sourcePane", refs.sourcePaneRef.current),
    sourceEditor: assertRef("sourceEditor", refs.sourceEditorRef.current),
    propertyForm: assertRef("propertyForm", refs.propertyFormRef.current),
    inspectorEmpty: assertRef("inspectorEmpty", refs.inspectorEmptyRef.current)
  };
}

export function useSvgStudio(): SvgStudioBindings {
  const refs: SvgStudioDomRefs = {
    appShellRef: useRef<HTMLDivElement>(null),
    topbarRef: useRef<HTMLElement>(null),
    leftPanelRef: useRef<HTMLElement>(null),
    rightPanelRef: useRef<HTMLElement>(null),
    fileInputRef: useRef<HTMLInputElement>(null),
    imageInputRef: useRef<HTMLInputElement>(null),
    importButtonRef: useRef<HTMLButtonElement>(null),
    saveButtonRef: useRef<HTMLButtonElement>(null),
    gridSnapButtonRef: useRef<HTMLButtonElement>(null),
    gridSnapSizeGroupRef: useRef<HTMLDivElement>(null),
    gridSnapSizeInputRef: useRef<HTMLInputElement>(null),
    gridSnapSizeSelectRef: useRef<HTMLSelectElement>(null),
    sourceToggleButtonRef: useRef<HTMLButtonElement>(null),
    collapseTopbarButtonRef: useRef<HTMLButtonElement>(null),
    showTopbarButtonRef: useRef<HTMLButtonElement>(null),
    hideLeftPanelButtonRef: useRef<HTMLButtonElement>(null),
    leftPanelInsertTabRef: useRef<HTMLButtonElement>(null),
    leftPanelLayersTabRef: useRef<HTMLButtonElement>(null),
    leftPanelInsertSectionRef: useRef<HTMLElement>(null),
    leftPanelLayersSectionRef: useRef<HTMLElement>(null),
    hideRightPanelButtonRef: useRef<HTMLButtonElement>(null),
    floatingLeftButtonRef: useRef<HTMLButtonElement>(null),
    floatingRightButtonRef: useRef<HTMLButtonElement>(null),
    insertImageButtonRef: useRef<HTMLButtonElement>(null),
    newDocumentButtonRef: useRef<HTMLButtonElement>(null),
    applySourceButtonRef: useRef<HTMLButtonElement>(null),
    exportButtonRef: useRef<HTMLButtonElement>(null),
    undoButtonRef: useRef<HTMLButtonElement>(null),
    redoButtonRef: useRef<HTMLButtonElement>(null),
    duplicateButtonRef: useRef<HTMLButtonElement>(null),
    deleteButtonRef: useRef<HTMLButtonElement>(null),
    zoomOutButtonRef: useRef<HTMLButtonElement>(null),
    zoomInButtonRef: useRef<HTMLButtonElement>(null),
    zoomResetButtonRef: useRef<HTMLButtonElement>(null),
    zoomLabelRef: useRef<HTMLSpanElement>(null),
    statusPillRef: useRef<HTMLSpanElement>(null),
    nodeCountBadgeRef: useRef<HTMLSpanElement>(null),
    treePanelRef: useRef<HTMLDivElement>(null),
    surfaceGridRef: useRef<HTMLDivElement>(null),
    svgHostRef: useRef<HTMLDivElement>(null),
    insertGridRef: useRef<HTMLDivElement>(null),
    surfaceInnerRef: useRef<HTMLDivElement>(null),
    workspaceSurfaceRef: useRef<HTMLElement>(null),
    workspaceContentRef: useRef<HTMLElement>(null),
    dropOverlayRef: useRef<HTMLDivElement>(null),
    contextMenuRef: useRef<HTMLDivElement>(null),
    bringToFrontButtonRef: useRef<HTMLButtonElement>(null),
    sendToBackButtonRef: useRef<HTMLButtonElement>(null),
    sourcePaneRef: useRef<HTMLElement>(null),
    sourceEditorRef: useRef<HTMLTextAreaElement>(null),
    propertyFormRef: useRef<HTMLFormElement>(null),
    inspectorEmptyRef: useRef<HTMLDivElement>(null)
  };

  const studioRef = useRef<MountedStudio | null>(null);

  useEffect(() => {
    studioRef.current = mountReactSvgStudio(toUiRefs(refs)) as MountedStudio;

    return () => {
      studioRef.current?.dispose?.();
      studioRef.current = null;
    };
  }, []);

  const workspaceSurfaceProps = useMemo<SvgStudioBindings["workspaceSurfaceProps"]>(() => ({
    onContextMenu: (event) => studioRef.current?.editor.onWorkspaceContextMenu(event.nativeEvent),
    onDragEnter: (event) => studioRef.current?.editor.onWorkspaceDragEnter(event.nativeEvent),
    onDragLeave: (event) => studioRef.current?.editor.onWorkspaceDragLeave(event.nativeEvent),
    onDragOver: (event) => studioRef.current?.editor.onWorkspaceDragOver(event.nativeEvent),
    onDrop: (event) => {
      void studioRef.current?.editor.onWorkspaceDrop(event.nativeEvent);
    },
    onPointerDown: (event) => studioRef.current?.editor.onWorkspacePointerDown(event.nativeEvent)
  }), []);

  return {
    refs,
    workspaceSurfaceProps
  };
}
