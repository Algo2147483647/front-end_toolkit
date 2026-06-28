import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const {
  PDFDocument,
  StandardFonts,
  rgb,
} = window.PDFLib;

const PROJECT_ATTACHMENT = "pdf-studio-project.json";
const PROJECT_VERSION = 1;
const DEFAULT_ZOOM = 1.2;
const DEFAULT_MARKUP_COLOR = "#dc2626";
const DEFAULT_HIGHLIGHT_COLOR = "#facc15";
const FONT_OPTIONS = [
  { value: "Helvetica", label: "Helvetica", exportFamily: "Helvetica" },
  { value: "Arial", label: "Arial", exportFamily: "Helvetica" },
  { value: "Verdana", label: "Verdana", exportFamily: "Helvetica" },
  { value: "Tahoma", label: "Tahoma", exportFamily: "Helvetica" },
  { value: "Trebuchet MS", label: "Trebuchet MS", exportFamily: "Helvetica" },
  { value: "Times Roman", label: "Times Roman", exportFamily: "Times Roman" },
  { value: "Georgia", label: "Georgia", exportFamily: "Times Roman" },
  { value: "Garamond", label: "Garamond", exportFamily: "Times Roman" },
  { value: "Courier", label: "Courier", exportFamily: "Courier" },
  { value: "Courier New", label: "Courier New", exportFamily: "Courier" },
  { value: "Lucida Console", label: "Lucida Console", exportFamily: "Courier" },
  { value: "Impact", label: "Impact", exportFamily: "Helvetica" },
];

const els = {
  emptyOpenPdfBtn: document.getElementById("emptyOpenPdfBtn"),
  topOpenPdfBtn: document.getElementById("topOpenPdfBtn"),
  topOpenProjectBtn: document.getElementById("topOpenProjectBtn"),
  topDownloadProjectBtn: document.getElementById("topDownloadProjectBtn"),
  topExportPdfBtn: document.getElementById("topExportPdfBtn"),
  exportMenu: document.getElementById("exportMenu"),
  exportOverwriteBtn: document.getElementById("exportOverwriteBtn"),
  exportCopyBtn: document.getElementById("exportCopyBtn"),
  pdfInput: document.getElementById("pdfInput"),
  projectInput: document.getElementById("projectInput"),
  imageInput: document.getElementById("imageInput"),
  toolGrid: document.getElementById("toolGrid"),
  canvasShell: document.getElementById("canvasShell"),
  pages: document.getElementById("pages"),
  emptyState: document.getElementById("emptyState"),
  documentTitle: document.getElementById("documentTitle"),
  pageCount: document.getElementById("pageCount"),
  objectCount: document.getElementById("objectCount"),
  autosaveState: document.getElementById("autosaveState"),
  zoomLabel: document.getElementById("zoomLabel"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  selectionTitle: document.getElementById("selectionTitle"),
  inspectorContent: document.getElementById("inspectorContent"),
  deleteBtn: document.getElementById("deleteBtn"),
};

const state = {
  fileName: "",
  sourcePdfBytes: null,
  pdfFileHandle: null,
  pdfjsDoc: null,
  pageInfos: [],
  elements: [],
  selectedId: null,
  selectedIds: [],
  editingTextId: null,
  activeTool: "select",
  zoom: DEFAULT_ZOOM,
  pendingImage: null,
  drag: null,
  suppressNextOverlayClick: false,
  zoomRenderId: 0,
};

lucide.createIcons();
wireEvents();
renderShell();

function wireEvents() {
  els.topOpenPdfBtn.addEventListener("click", openPdfFromPicker);
  els.emptyOpenPdfBtn.addEventListener("click", openPdfFromPicker);
  els.topOpenProjectBtn.addEventListener("click", () => els.projectInput.click());
  els.topDownloadProjectBtn.addEventListener("click", downloadProject);
  els.topExportPdfBtn.addEventListener("click", toggleExportMenu);
  els.exportOverwriteBtn.addEventListener("click", () => exportPdf("overwrite"));
  els.exportCopyBtn.addEventListener("click", () => exportPdf("copy"));
  els.pdfInput.addEventListener("change", handlePdfInput);
  els.projectInput.addEventListener("change", handleProjectInput);
  els.imageInput.addEventListener("change", handleImageInput);
  els.zoomInBtn.addEventListener("click", () => setZoom(Math.min(2.4, state.zoom + 0.1)));
  els.zoomOutBtn.addEventListener("click", () => setZoom(Math.max(0.6, state.zoom - 0.1)));
  document.addEventListener("wheel", handleDocumentWheel, { passive: false, capture: true });
  els.canvasShell.addEventListener("wheel", handleCanvasWheel, { passive: false, capture: true });
  els.deleteBtn.addEventListener("click", deleteSelection);
  els.toolGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (!button) return;
    setTool(button.dataset.tool);
  });
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedIds.length && !isTypingTarget(event.target)) {
      event.preventDefault();
      deleteSelection();
    }
    if (event.key === "Escape") {
      selectElement(null);
      setTool("select");
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".export-menu-shell")) closeExportMenu();
  });
}

async function openPdfFromPicker() {
  closeExportMenu();
  if (!window.showOpenFilePicker) {
    els.pdfInput.click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "PDF files", accept: { "application/pdf": [".pdf"] } }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    const file = await handle.getFile();
    await openPdfFile(file, handle);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      toast("Could not open that PDF.");
    }
  }
}

async function handlePdfInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await openPdfFile(file, null);
  event.target.value = "";
}

async function openPdfFile(file, fileHandle) {
  try {
    setStatus("Loading PDF...");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const embeddedProject = await readEmbeddedProject(bytes);
    if (embeddedProject) {
      const sourceBytes = base64ToBytes(embeddedProject.sourcePdfBase64);
      await loadDocument({
        fileName: file.name.replace(/\.pdf$/i, " editable.pdf"),
        sourcePdfBytes: sourceBytes,
        elements: embeddedProject.elements || [],
        pdfFileHandle: fileHandle,
      });
      toast("Editable project data restored from the imported PDF.");
    } else {
      await loadDocument({ fileName: file.name, sourcePdfBytes: bytes, elements: [], pdfFileHandle: fileHandle });
    }
  } catch (error) {
    console.error(error);
    toast("Could not open that PDF.");
  } finally {
    setStatus("Ready");
  }
}

async function handleProjectInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const project = JSON.parse(await file.text());
    if (!project.sourcePdfBase64) throw new Error("Missing source PDF");
    await loadDocument({
      fileName: project.fileName || file.name.replace(/\.json$/i, ".pdf"),
      sourcePdfBytes: base64ToBytes(project.sourcePdfBase64),
      elements: project.elements || [],
      pdfFileHandle: null,
    });
    toast("Editable project opened.");
  } catch (error) {
    console.error(error);
    toast("Could not open that project file.");
  } finally {
    event.target.value = "";
  }
}

async function handleImageInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    toast("Use a PNG or JPEG image.");
    event.target.value = "";
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await validateImageDataUrl(dataUrl);
    state.pendingImage = { dataUrl, mimeType: file.type, name: file.name };
    setTool("image");
    toast("Click a page to place the image.");
  } catch (error) {
    console.warn("Image rejected", error);
    state.pendingImage = null;
    setTool("select");
    toast("That image could not be decoded. Use a valid PNG or JPEG.");
  }
  event.target.value = "";
}

async function loadDocument({ fileName, sourcePdfBytes, elements, pdfFileHandle = null }) {
  state.fileName = fileName;
  state.sourcePdfBytes = sourcePdfBytes;
  state.pdfFileHandle = pdfFileHandle;
  state.elements = hydrateElements(elements);
  state.selectedId = null;
  state.selectedIds = [];
  state.editingTextId = null;
  state.pdfjsDoc = await pdfjsLib.getDocument({ data: sourcePdfBytes.slice() }).promise;
  state.pageInfos = [];
  for (let index = 1; index <= state.pdfjsDoc.numPages; index += 1) {
    const page = await state.pdfjsDoc.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    state.pageInfos.push({ pageNumber: index, width: viewport.width, height: viewport.height });
  }
  await renderPages();
  renderShell();
  renderInspector();
}

function hydrateElements(elements) {
  return elements.map((element) => ({
    id: element.id || createId(),
    opacity: element.opacity ?? 1,
    ...element,
  }));
}

async function renderPages() {
  els.pages.innerHTML = "";
  if (!state.pdfjsDoc) return;
  for (let index = 1; index <= state.pdfjsDoc.numPages; index += 1) {
    const page = await state.pdfjsDoc.getPage(index);
    const info = state.pageInfos[index - 1];
    const frame = document.createElement("article");
    frame.className = "page-frame";
    frame.dataset.pageNumber = String(index);
    frame.style.width = `${info.width * state.zoom}px`;
    frame.style.height = `${info.height * state.zoom}px`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: state.zoom * ratio });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${info.width * state.zoom}px`;
    canvas.style.height = `${info.height * state.zoom}px`;
    await page.render({ canvasContext: context, viewport }).promise;

    const overlay = document.createElement("div");
    overlay.className = "page-overlay";
    overlay.dataset.pageNumber = String(index);
    overlay.dataset.mode = state.activeTool === "select" ? "select" : "insert";
    overlay.addEventListener("pointerdown", handleOverlayPointerDown);
    overlay.addEventListener("click", handleOverlayClick);

    frame.append(canvas, overlay);
    els.pages.append(frame);
    renderPageElements(index);
  }
}

function renderPageElements(pageNumber) {
  const overlay = getOverlay(pageNumber);
  if (!overlay) return;
  overlay.querySelectorAll(".pdf-object").forEach((node) => node.remove());
  state.elements
    .filter((element) => element.page === pageNumber)
    .forEach((element) => overlay.append(renderElement(element)));
}

function renderElement(element) {
  if (element.type === "line" || element.type === "arrow") return renderLineElement(element);
  const node = document.createElement("div");
  node.className = `pdf-object ${element.type}-object`;
  node.dataset.id = element.id;
  node.style.left = `${element.x * state.zoom}px`;
  node.style.top = `${element.y * state.zoom}px`;
  node.style.width = `${element.w * state.zoom}px`;
  node.style.height = `${element.h * state.zoom}px`;
  node.style.opacity = String(element.opacity ?? 1);
  node.addEventListener("pointerdown", (event) => startElementDrag(event, element.id));
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    selectElement(element.id);
  });

  const isSelected = state.selectedIds.includes(element.id);
  if (isSelected) node.classList.add("selected");

  if (element.type === "text") {
    const isEditing = element.id === state.editingTextId;
    node.textContent = element.text || "";
    node.contentEditable = isEditing ? "true" : "false";
    node.spellcheck = false;
    node.style.fontFamily = element.fontFamily;
    node.style.fontSize = `${element.fontSize * state.zoom}px`;
    node.style.lineHeight = String(element.lineHeight || 1.25);
    node.style.color = element.color;
    node.style.fontWeight = element.bold ? "800" : "400";
    node.style.fontStyle = element.italic ? "italic" : "normal";
    node.style.textAlign = element.align || "left";
    node.addEventListener("input", () => {
      element.text = node.textContent || "";
      updateInspectorTextValue(element.text);
      markChanged();
    });
    node.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      enterTextEdit(element.id);
    });
  }

  if (element.type === "image") {
    const image = document.createElement("img");
    image.src = element.dataUrl;
    image.alt = element.name || "Inserted image";
    node.append(image);
  }

  if (element.type === "rect" || element.type === "highlight") {
    const strokeWidth = element.type === "highlight" ? 0 : Math.max(1, element.strokeWidth || 2) * state.zoom;
    node.style.border = strokeWidth > 0 ? `${strokeWidth}px solid ${element.strokeColor}` : "0";
    node.style.background = element.fillColor || "transparent";
    if (element.type === "highlight") node.style.mixBlendMode = "multiply";
  }

  if (isSelected && state.selectedIds.length === 1) {
    if (element.type === "rect") {
      ["nw", "ne", "sw", "se"].forEach((corner) => node.append(createResizeHandle(element.id, corner)));
    } else {
      node.append(createResizeHandle(element.id, "se"));
    }
  }
  return node;
}

function renderLineElement(element) {
  const bounds = getLineBounds(element);
  const node = document.createElement("div");
  node.className = `pdf-object line-object ${element.type}-object`;
  node.dataset.id = element.id;
  node.style.left = `${bounds.left * state.zoom}px`;
  node.style.top = `${bounds.top * state.zoom}px`;
  node.style.width = `${bounds.width * state.zoom}px`;
  node.style.height = `${bounds.height * state.zoom}px`;
  node.style.opacity = String(element.opacity ?? 1);
  node.addEventListener("pointerdown", (event) => startElementDrag(event, element.id));
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    selectElement(element.id);
  });
  const isSelected = state.selectedIds.includes(element.id);
  if (isSelected) node.classList.add("selected");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", `${Math.max(1, bounds.width * state.zoom)}`);
  svg.setAttribute("height", `${Math.max(1, bounds.height * state.zoom)}`);
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(element.x1 - bounds.left));
  line.setAttribute("y1", String(element.y1 - bounds.top));
  line.setAttribute("x2", String(element.x2 - bounds.left));
  line.setAttribute("y2", String(element.y2 - bounds.top));
  line.setAttribute("stroke", element.strokeColor);
  line.setAttribute("stroke-width", String(element.strokeWidth || 3));
  line.setAttribute("stroke-linecap", "round");
  svg.append(line);

  if (element.type === "arrow") {
    const head = arrowHeadPoints(element.x1, element.y1, element.x2, element.y2, 14);
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", head.map((point) => `${point.x - bounds.left},${point.y - bounds.top}`).join(" "));
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", element.strokeColor);
    polyline.setAttribute("stroke-width", String(element.strokeWidth || 3));
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    svg.append(polyline);
  }

  node.append(svg);
  if (isSelected && state.selectedIds.length === 1) {
    node.append(createPointHandle(element.id, "start", element.x1 - bounds.left, element.y1 - bounds.top));
    node.append(createPointHandle(element.id, "end", element.x2 - bounds.left, element.y2 - bounds.top));
  }
  return node;
}

function createResizeHandle(id, corner = "se") {
  const handle = document.createElement("div");
  handle.className = `resize-handle ${corner}`;
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    const element = findElement(id);
    state.drag = {
      mode: "resize",
      id,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      origin: structuredClone(element),
    };
    safeSetPointerCapture(handle, event.pointerId);
  });
  return handle;
}

function createPointHandle(id, point, x, y) {
  const handle = document.createElement("div");
  handle.className = `point-handle ${point}`;
  handle.style.left = `${x * state.zoom - 6}px`;
  handle.style.top = `${y * state.zoom - 6}px`;
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    state.drag = {
      mode: "point",
      id,
      point,
      startX: event.clientX,
      startY: event.clientY,
    };
    safeSetPointerCapture(handle, event.pointerId);
  });
  return handle;
}

function handleOverlayPointerDown(event) {
  if (event.target !== event.currentTarget) return;
  if (state.activeTool === "select") {
    beginMarqueeSelect(event, event.currentTarget);
    return;
  }
  if (["rect", "line", "arrow", "highlight"].includes(state.activeTool)) {
    beginOverlayCreate(event, event.currentTarget);
  }
}

function handleOverlayClick(event) {
  if (event.target !== event.currentTarget) return;
  if (state.suppressNextOverlayClick) {
    state.suppressNextOverlayClick = false;
    return;
  }
  const pageNumber = Number(event.currentTarget.dataset.pageNumber);
  const point = eventToPdfPoint(event, event.currentTarget);
  if (state.activeTool === "text") {
    addElement(defaultTextElement(pageNumber, point));
  } else if (state.activeTool === "image") {
    if (!state.pendingImage) {
      els.imageInput.click();
      return;
    }
    addElement(defaultImageElement(pageNumber, point, state.pendingImage));
    state.pendingImage = null;
    renderShell();
  }
}

function beginMarqueeSelect(event, overlay) {
  if (event.button !== 0) return;
  event.preventDefault();
  const pageNumber = Number(overlay.dataset.pageNumber);
  const start = eventToPdfPoint(event, overlay);
  const marquee = document.createElement("div");
  marquee.className = "selection-marquee";
  overlay.append(marquee);
  state.drag = {
    mode: "marquee",
    page: pageNumber,
    overlay,
    marquee,
    start,
    moved: false,
  };
  safeSetPointerCapture(overlay, event.pointerId);
}

function beginOverlayCreate(event, overlay) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const pageNumber = Number(overlay.dataset.pageNumber);
  const start = eventToPdfPoint(event, overlay);
  const type = state.activeTool;
  const element = type === "rect" || type === "highlight"
    ? rectFromDrag(pageNumber, start, start)
    : lineFromDrag(pageNumber, start, start, type);
  if (type === "highlight") applyHighlightDefaults(element);
  state.elements.push(element);
  state.selectedId = element.id;
  state.selectedIds = [element.id];
  state.editingTextId = null;
  state.drag = {
    mode: "create",
    id: element.id,
    type,
    page: pageNumber,
    overlay,
    start,
    moved: false,
  };
  renderPageElements(pageNumber);
  renderInspector();
  renderShell();
  safeSetPointerCapture(overlay, event.pointerId);
}

function startElementDrag(event, id) {
  if (event.target.classList.contains("resize-handle") || event.target.classList.contains("point-handle")) return;
  if (event.button !== 0) return;
  event.stopPropagation();
  const element = findElement(id);
  if (element?.type === "text" && state.editingTextId === id) return;
  if (!state.selectedIds.includes(id)) selectElement(id);
  if (element.type === "text" && event.detail > 1) return;
  state.drag = {
    mode: "move",
    id,
    startX: event.clientX,
    startY: event.clientY,
    origin: structuredClone(element),
    origins: state.selectedIds.map((selectedId) => [selectedId, structuredClone(findElement(selectedId))]),
  };
  safeSetPointerCapture(event.currentTarget, event.pointerId);
}

function handlePointerMove(event) {
  if (!state.drag) return;
  if (state.drag.mode === "marquee") {
    const current = eventToPdfPoint(event, state.drag.overlay);
    state.drag.moved = state.drag.moved || distanceBetween(state.drag.start, current) > 3;
    updateMarqueeNode(state.drag.marquee, rectGeometryFromPoints(state.drag.start, current));
    return;
  }
  const element = findElement(state.drag.id);
  if (!element) return;
  if (state.drag.mode === "create") {
    const current = eventToPdfPoint(event, state.drag.overlay);
    state.drag.moved = state.drag.moved || distanceBetween(state.drag.start, current) > 3;
    if (state.drag.type === "rect" || state.drag.type === "highlight") {
      Object.assign(element, rectGeometryFromPoints(state.drag.start, current));
    } else {
      element.x2 = current.x;
      element.y2 = current.y;
    }
    renderPageElements(element.page);
    renderInspector();
    markChanged();
    return;
  }
  const dx = (event.clientX - state.drag.startX) / state.zoom;
  const dy = (event.clientY - state.drag.startY) / state.zoom;
  if (state.drag.mode === "move") {
    if (state.drag.origins?.length > 1) {
      state.drag.origins.forEach(([id, origin]) => {
        const selectedElement = findElement(id);
        if (!selectedElement) return;
        moveElementFromOrigin(selectedElement, origin, dx, dy);
      });
    } else {
      moveElementFromOrigin(element, state.drag.origin, dx, dy);
    }
  }
  if (state.drag.mode === "resize") {
    resizeBoxElement(element, state.drag.origin, state.drag.corner, dx, dy);
  }
  if (state.drag.mode === "point") {
    const suffix = state.drag.point === "start" ? "1" : "2";
    element[`x${suffix}`] += dx;
    element[`y${suffix}`] += dy;
    state.drag.startX = event.clientX;
    state.drag.startY = event.clientY;
  }
  renderPageElements(element.page);
  renderInspector();
  markChanged();
}

function endDrag() {
  if (state.drag?.mode === "marquee") {
    const selectionRect = parseMarqueeRect(state.drag.marquee);
    state.drag.marquee.remove();
    if (state.drag.moved) {
      const ids = state.elements
        .filter((element) => element.page === state.drag.page)
        .filter((element) => rectsIntersect(selectionRect, getElementRect(element)))
        .map((element) => element.id);
      setSelection(ids);
    } else {
      selectElement(null);
    }
    state.drag = null;
    return;
  }
  if (state.drag?.mode === "create") {
    const element = findElement(state.drag.id);
    if (element) {
      if (state.drag.type === "rect" || state.drag.type === "highlight") {
        const tooSmall = state.drag.type === "highlight" ? element.w < 1 || element.h < 1 : element.w < 6 || element.h < 6;
        if (!state.drag.moved || tooSmall) {
          const fallback = state.drag.type === "highlight"
            ? defaultHighlightElement(element.page, state.drag.start)
            : defaultRectElement(element.page, state.drag.start);
          Object.assign(element, { x: fallback.x, y: fallback.y, w: fallback.w, h: fallback.h });
        }
      } else if (!state.drag.moved || distanceBetween({ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }) < 6) {
        const fallback = defaultLineElement(element.page, state.drag.start, state.drag.type);
        Object.assign(element, { x1: fallback.x1, y1: fallback.y1, x2: fallback.x2, y2: fallback.y2 });
      }
      renderPageElements(element.page);
      renderInspector();
      renderShell();
      markChanged();
    }
    state.suppressNextOverlayClick = true;
  }
  state.drag = null;
}

function addElement(element) {
  state.elements.push(element);
  selectElement(element.id);
  renderPageElements(element.page);
  renderShell();
  markChanged();
}

function selectElement(id, force = false) {
  const previous = state.selectedId ? findElement(state.selectedId) : null;
  const shouldClearEditing = state.editingTextId && state.editingTextId !== id;
  if (!force && state.selectedId === id && !shouldClearEditing) {
    renderInspector();
    return;
  }
  if (shouldClearEditing) {
    state.editingTextId = null;
  }
  state.selectedId = id;
  state.selectedIds = id ? [id] : [];
  const current = id ? findElement(id) : null;
  if (previous) renderPageElements(previous.page);
  if (current && (!previous || previous.page !== current.page)) renderPageElements(current.page);
  if (current && previous?.page === current.page) renderPageElements(current.page);
  renderInspector();
}

function setSelection(ids) {
  const previousPages = new Set(state.selectedIds.map((id) => findElement(id)?.page).filter(Boolean));
  state.selectedIds = [...new Set(ids)];
  state.selectedId = state.selectedIds[0] || null;
  if (!state.selectedIds.includes(state.editingTextId)) state.editingTextId = null;
  const nextPages = new Set(state.selectedIds.map((id) => findElement(id)?.page).filter(Boolean));
  new Set([...previousPages, ...nextPages]).forEach((page) => renderPageElements(page));
  renderInspector();
}

function enterTextEdit(id) {
  state.editingTextId = id;
  selectElement(id, true);
  window.requestAnimationFrame(() => focusTextElement(id));
}

function deleteSelection() {
  if (!state.selectedIds.length) return;
  const pages = new Set(state.selectedIds.map((id) => findElement(id)?.page).filter(Boolean));
  state.elements = state.elements.filter((item) => !state.selectedIds.includes(item.id));
  state.selectedId = null;
  state.selectedIds = [];
  pages.forEach((page) => renderPageElements(page));
  renderInspector();
  renderShell();
  markChanged();
}

function renderInspector() {
  const element = state.selectedId ? findElement(state.selectedId) : null;
  els.deleteBtn.disabled = !state.selectedIds.length;
  if (state.selectedIds.length > 1) {
    els.selectionTitle.textContent = `${state.selectedIds.length} selected`;
    els.inspectorContent.innerHTML = `
      <div class="empty-inspector">
        <i data-lucide="mouse-pointer-2"></i>
        <p>${state.selectedIds.length} objects selected. Drag any selected object to move the group, or delete them together.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  if (!element) {
    els.selectionTitle.textContent = "No selection";
    els.inspectorContent.innerHTML = `
      <div class="empty-inspector">
        <i data-lucide="scan-search"></i>
        <p>Select an object on the page to edit its position and styling.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  els.selectionTitle.textContent = titleForElement(element);
  els.inspectorContent.innerHTML = [
    positionFields(element),
    textFields(element),
    shapeFields(element),
    imageFields(element),
  ].filter(Boolean).join("");
  wireInspectorFields(element);
  lucide.createIcons();
}

function positionFields(element) {
  if (element.type === "line" || element.type === "arrow") {
    return `
      <section class="field-group">
        <h3>Position</h3>
        <div class="field-grid">
          ${numberField("x1", "X1", element.x1)}
          ${numberField("y1", "Y1", element.y1)}
          ${numberField("x2", "X2", element.x2)}
          ${numberField("y2", "Y2", element.y2)}
          ${numberField("strokeWidth", "Stroke", element.strokeWidth || 3)}
          ${rangeField("opacity", "Opacity", element.opacity ?? 1, 0, 1, 0.05)}
        </div>
      </section>
    `;
  }
  return `
    <section class="field-group">
      <h3>Position</h3>
      <div class="field-grid">
        ${numberField("x", "X", element.x)}
        ${numberField("y", "Y", element.y)}
        ${numberField("w", "Width", element.w)}
        ${numberField("h", "Height", element.h)}
        ${rangeField("opacity", "Opacity", element.opacity ?? 1, 0, 1, 0.05)}
      </div>
    </section>
  `;
}

function textFields(element) {
  if (element.type !== "text") return "";
  return `
    <section class="field-group">
      <h3>Text</h3>
      <div class="field-grid">
        <div class="field span-2">
          <label for="prop-text">Content</label>
          <textarea id="prop-text" data-prop="text">${escapeHtml(element.text || "")}</textarea>
        </div>
        <div class="field">
          <label for="prop-fontFamily">Font</label>
          <select id="prop-fontFamily" data-prop="fontFamily">
            ${FONT_OPTIONS.map((font) => option(font.value, element.fontFamily, font.label)).join("")}
          </select>
        </div>
        ${numberField("fontSize", "Size", element.fontSize, 6, 96, 1)}
        ${colorField("color", "Color", element.color)}
        <div class="field">
          <label>Style</label>
          <div class="toggle-row">
            <button class="command ${element.bold ? "active" : ""}" data-toggle="bold" type="button">B</button>
            <button class="command ${element.italic ? "active" : ""}" data-toggle="italic" type="button">I</button>
          </div>
        </div>
        <div class="field span-2">
          <label for="prop-align">Align</label>
          <select id="prop-align" data-prop="align">
            ${option("left", element.align || "left")}
            ${option("center", element.align || "left")}
            ${option("right", element.align || "left")}
          </select>
        </div>
      </div>
    </section>
  `;
}

function shapeFields(element) {
  if (!["rect", "line", "arrow", "highlight"].includes(element.type)) return "";
  return `
    <section class="field-group">
      <h3>Style</h3>
      <div class="field-grid">
        ${element.type === "rect" ? numberField("strokeWidth", "Stroke", element.strokeWidth || 2, 0, 64, 1) : ""}
        ${element.type === "highlight" ? "" : colorField("strokeColor", "Stroke", element.strokeColor)}
        ${element.type === "rect" || element.type === "highlight" ? colorField("fillColor", element.type === "highlight" ? "Highlight" : "Fill", element.fillColor || DEFAULT_HIGHLIGHT_COLOR) : ""}
      </div>
    </section>
  `;
}

function imageFields(element) {
  if (element.type !== "image") return "";
  return `
    <section class="field-group">
      <h3>Image</h3>
      <div class="field-grid">
        <div class="field span-2">
          <label>Name</label>
          <input value="${escapeHtml(element.name || "Inserted image")}" disabled>
        </div>
      </div>
    </section>
  `;
}

function wireInspectorFields(element) {
  els.inspectorContent.querySelectorAll("[data-prop]").forEach((input) => {
    input.addEventListener("input", () => {
      const prop = input.dataset.prop;
      const isNumber = input.type === "number" || input.type === "range" || input.dataset.valueType === "number";
      element[prop] = isNumber ? Number(input.value) : input.value;
      syncLinkedInputs(input);
      renderPageElements(element.page);
      renderShell();
      markChanged();
    });
  });
  els.inspectorContent.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const prop = button.dataset.toggle;
      element[prop] = !element[prop];
      renderPageElements(element.page);
      renderInspector();
      markChanged();
    });
  });
}

function updateInspectorTextValue(value) {
  const textArea = els.inspectorContent.querySelector("[data-prop='text']");
  if (textArea && document.activeElement !== textArea) textArea.value = value;
}

function renderShell() {
  els.emptyState.style.display = state.pdfjsDoc ? "none" : "grid";
  els.documentTitle.textContent = state.fileName || "No PDF loaded";
  els.pageCount.textContent = `${state.pageInfos.length} page${state.pageInfos.length === 1 ? "" : "s"}`;
  els.objectCount.textContent = `${state.elements.length} object${state.elements.length === 1 ? "" : "s"}`;
  els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  els.topDownloadProjectBtn.disabled = !state.sourcePdfBytes;
  els.topExportPdfBtn.disabled = !state.sourcePdfBytes;
  els.exportOverwriteBtn.disabled = !state.sourcePdfBytes || !state.pdfFileHandle;
  els.exportOverwriteBtn.title = state.pdfFileHandle ? "" : "Import with the top import button in a supported browser to overwrite the original file.";
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === state.activeTool);
  });
  document.querySelectorAll(".page-overlay").forEach((overlay) => {
    overlay.dataset.mode = state.activeTool === "select" ? "select" : "insert";
  });
}

function setTool(tool) {
  if (tool === "image" && !state.pendingImage) {
    els.imageInput.click();
  }
  state.activeTool = tool;
  renderShell();
}

async function setZoom(zoom) {
  state.zoom = clampZoom(zoom);
  renderShell();
  const renderId = ++state.zoomRenderId;
  await renderPages();
  if (renderId !== state.zoomRenderId) return;
}

async function handleCanvasWheel(event) {
  if (!state.pdfjsDoc || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const oldZoom = state.zoom;
  const direction = event.deltaY > 0 ? -1 : 1;
  const step = Math.abs(event.deltaY) > 90 ? 0.16 : 0.08;
  const nextZoom = clampZoom(oldZoom + direction * step);
  if (nextZoom === oldZoom) return;
  const scrollLeft = els.canvasShell.scrollLeft;
  const scrollTop = els.canvasShell.scrollTop;
  await setZoom(nextZoom);
  els.canvasShell.scrollLeft = scrollLeft;
  els.canvasShell.scrollTop = scrollTop;
}

function handleDocumentWheel(event) {
  if (!state.pdfjsDoc || (!event.ctrlKey && !event.metaKey)) return;
  if (!event.target.closest?.("#canvasShell")) return;
  handleCanvasWheel(event);
}

function clampZoom(zoom) {
  return Number(Math.min(2.4, Math.max(0.6, zoom)).toFixed(2));
}

function resizeBoxElement(element, origin, corner, dx, dy) {
  if (element.type !== "rect" && element.type !== "highlight" && corner !== "se") {
    element.w = Math.max(24, origin.w + dx);
    element.h = Math.max(18, origin.h + dy);
    return;
  }

  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.w;
  let bottom = origin.y + origin.h;

  if (corner.includes("w")) left += dx;
  if (corner.includes("e")) right += dx;
  if (corner.includes("n")) top += dy;
  if (corner.includes("s")) bottom += dy;

  const minSize = element.type === "highlight" ? 1 : 6;
  const nextLeft = Math.min(left, right);
  const nextTop = Math.min(top, bottom);
  const nextRight = Math.max(left, right);
  const nextBottom = Math.max(top, bottom);

  element.x = nextLeft;
  element.y = nextTop;
  element.w = Math.max(minSize, nextRight - nextLeft);
  element.h = Math.max(minSize, nextBottom - nextTop);
}

function setStatus(text) {
  els.autosaveState.textContent = text;
}

function markChanged() {
  setStatus("Unsaved changes");
}

async function downloadProject() {
  if (!state.sourcePdfBytes) {
    toast("Import a PDF first.");
    return;
  }
  const project = await buildProjectPayload();
  downloadBlob(
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    `${baseName(state.fileName || "document")}.pdf-studio.json`,
  );
  setStatus("Editable project downloaded");
}

function toggleExportMenu(event) {
  event.stopPropagation();
  if (!state.sourcePdfBytes) {
    toast("Import a PDF first.");
    return;
  }
  els.exportMenu.hidden = !els.exportMenu.hidden;
}

function closeExportMenu() {
  els.exportMenu.hidden = true;
}

async function exportPdf(mode = "copy") {
  closeExportMenu();
  if (!state.sourcePdfBytes) {
    toast("Import a PDF first.");
    return;
  }
  if (mode === "overwrite" && !state.pdfFileHandle) {
    toast("Overwrite is only available when the original PDF was imported with file access.");
    return;
  }
  try {
    setStatus("Exporting...");
    const bytes = await buildEditedPdfBytes();
    if (mode === "overwrite") {
      const writable = await state.pdfFileHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      setStatus("Original PDF overwritten");
      toast("Original PDF overwritten.");
    } else {
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${baseName(state.fileName || "document")}-edited.pdf`);
      setStatus("PDF copy exported");
      toast("PDF copy exported.");
    }
  } catch (error) {
    console.error(error);
    toast("Export failed.");
    setStatus("Ready");
  }
}

async function buildEditedPdfBytes() {
  const pdfDoc = await PDFDocument.load(state.sourcePdfBytes.slice());
  const fonts = await loadFonts(pdfDoc);
  for (const element of state.elements) {
    const page = pdfDoc.getPage(element.page - 1);
    if (!page) continue;
    if (element.type === "text") drawTextElement(page, element, fonts);
    if (element.type === "image") await drawImageElement(pdfDoc, page, element);
    if (element.type === "rect" || element.type === "highlight") drawRectElement(page, element);
    if (element.type === "line" || element.type === "arrow") drawLineAnnotation(page, element);
  }
  const project = await buildProjectPayload();
  await pdfDoc.attach(new TextEncoder().encode(JSON.stringify(project)), PROJECT_ATTACHMENT, {
    mimeType: "application/json",
    description: "Editable PDF Studio project data",
    creationDate: new Date(),
    modificationDate: new Date(),
  });
  pdfDoc.setTitle(baseName(state.fileName || "PDF Studio export"));
  pdfDoc.setProducer("PDF Studio");
  return pdfDoc.save();
}

async function buildProjectPayload() {
  return {
    app: "PDF Studio",
    version: PROJECT_VERSION,
    fileName: state.fileName,
    exportedAt: new Date().toISOString(),
    sourcePdfBase64: bytesToBase64(state.sourcePdfBytes),
    elements: state.elements,
  };
}

async function readEmbeddedProject(bytes) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    const doc = await loadingTask.promise;
    const attachments = await doc.getAttachments();
    const attachment = attachments?.[PROJECT_ATTACHMENT];
    if (!attachment?.content) return null;
    const text = new TextDecoder().decode(attachment.content);
    return JSON.parse(text);
  } catch (error) {
    console.warn("No embedded project data found", error);
    return null;
  }
}

async function loadFonts(pdfDoc) {
  const [helvetica, helveticaBold, helveticaItalic, times, timesBold, timesItalic, courier, courierBold, courierItalic] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
    pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    pdfDoc.embedFont(StandardFonts.TimesRoman),
    pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    pdfDoc.embedFont(StandardFonts.Courier),
    pdfDoc.embedFont(StandardFonts.CourierBold),
    pdfDoc.embedFont(StandardFonts.CourierOblique),
  ]);
  return {
    Helvetica: { regular: helvetica, bold: helveticaBold, italic: helveticaItalic, boldItalic: helveticaBold },
    "Times Roman": { regular: times, bold: timesBold, italic: timesItalic, boldItalic: timesBold },
    Courier: { regular: courier, bold: courierBold, italic: courierItalic, boldItalic: courierBold },
  };
}

function drawTextElement(page, element, fonts) {
  const fontSet = fonts[getExportFontFamily(element.fontFamily)] || fonts.Helvetica;
  const font = element.bold && element.italic ? fontSet.boldItalic : element.bold ? fontSet.bold : element.italic ? fontSet.italic : fontSet.regular;
  const fontSize = Number(element.fontSize || 16);
  const lineHeight = fontSize * (element.lineHeight || 1.25);
  const pageHeight = page.getHeight();
  const lines = wrapText(element.text || "", font, fontSize, Math.max(8, element.w - 8));
  lines.slice(0, Math.floor(element.h / lineHeight) || 1).forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, fontSize);
    const align = element.align || "left";
    const offset = align === "center" ? (element.w - textWidth) / 2 : align === "right" ? element.w - textWidth - 4 : 4;
    page.drawText(line, {
      x: element.x + Math.max(4, offset),
      y: pageHeight - element.y - 4 - fontSize - index * lineHeight,
      size: fontSize,
      font,
      color: hexToRgb(element.color),
      opacity: element.opacity ?? 1,
    });
  });
}

async function drawImageElement(pdfDoc, page, element) {
  const bytes = dataUrlToBytes(element.dataUrl);
  const embedded = element.mimeType === "image/jpeg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
  page.drawImage(embedded, {
    x: element.x,
    y: page.getHeight() - element.y - element.h,
    width: element.w,
    height: element.h,
    opacity: element.opacity ?? 1,
  });
}

function drawRectElement(page, element) {
  const isHighlight = element.type === "highlight";
  page.drawRectangle({
    x: element.x,
    y: page.getHeight() - element.y - element.h,
    width: element.w,
    height: element.h,
    borderColor: hexToRgb(element.strokeColor || DEFAULT_MARKUP_COLOR),
    color: hexToRgb(element.fillColor || (isHighlight ? DEFAULT_HIGHLIGHT_COLOR : "#ffffff")),
    borderWidth: isHighlight ? 0 : element.strokeWidth || 2,
    opacity: element.fillColor === "transparent" ? 0 : element.opacity ?? 1,
    borderOpacity: isHighlight ? 0 : element.opacity ?? 1,
  });
}

function drawLineAnnotation(page, element) {
  const pageHeight = page.getHeight();
  const start = { x: element.x1, y: pageHeight - element.y1 };
  const end = { x: element.x2, y: pageHeight - element.y2 };
  const options = {
    start,
    end,
    thickness: element.strokeWidth || 3,
    color: hexToRgb(element.strokeColor),
    opacity: element.opacity ?? 1,
  };
  page.drawLine(options);
  if (element.type === "arrow") {
    const head = arrowHeadPoints(element.x1, element.y1, element.x2, element.y2, 14);
    page.drawLine({
      start: end,
      end: { x: head[0].x, y: pageHeight - head[0].y },
      thickness: element.strokeWidth || 3,
      color: hexToRgb(element.strokeColor),
      opacity: element.opacity ?? 1,
    });
    page.drawLine({
      start: end,
      end: { x: head[2].x, y: pageHeight - head[2].y },
      thickness: element.strokeWidth || 3,
      color: hexToRgb(element.strokeColor),
      opacity: element.opacity ?? 1,
    });
  }
}

function wrapText(text, font, size, maxWidth) {
  const output = [];
  text.split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      output.push("");
      return;
    }
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) {
        line = test;
      } else {
        output.push(line);
        line = word;
      }
    });
    output.push(line);
  });
  return output;
}

function defaultTextElement(page, point) {
  return {
    id: createId(),
    type: "text",
    page,
    x: point.x,
    y: point.y,
    w: 220,
    h: 70,
    text: "Double-click to edit",
    fontFamily: "Helvetica",
    fontSize: 18,
    lineHeight: 1.25,
    color: DEFAULT_MARKUP_COLOR,
    bold: false,
    italic: false,
    align: "left",
    opacity: 1,
  };
}

function defaultImageElement(page, point, image) {
  return {
    id: createId(),
    type: "image",
    page,
    x: point.x,
    y: point.y,
    w: 180,
    h: 120,
    dataUrl: image.dataUrl,
    mimeType: image.mimeType,
    name: image.name,
    opacity: 1,
  };
}

function defaultRectElement(page, point) {
  return {
    id: createId(),
    type: "rect",
    page,
    x: point.x,
    y: point.y,
    w: 180,
    h: 92,
    strokeColor: DEFAULT_MARKUP_COLOR,
    fillColor: "transparent",
    strokeWidth: 2,
    opacity: 1,
  };
}

function defaultHighlightElement(page, point) {
  return {
    id: createId(),
    type: "highlight",
    page,
    x: point.x,
    y: point.y,
    w: 220,
    h: 30,
    strokeColor: DEFAULT_HIGHLIGHT_COLOR,
    fillColor: DEFAULT_HIGHLIGHT_COLOR,
    strokeWidth: 0,
    opacity: 0.45,
  };
}

function defaultLineElement(page, point, type) {
  return {
    id: createId(),
    type,
    page,
    x1: point.x,
    y1: point.y,
    x2: point.x + 170,
    y2: point.y,
    strokeColor: DEFAULT_MARKUP_COLOR,
    strokeWidth: 3,
    opacity: 1,
  };
}

function rectFromDrag(page, start, current) {
  return {
    id: createId(),
    type: "rect",
    page,
    ...rectGeometryFromPoints(start, current),
    strokeColor: DEFAULT_MARKUP_COLOR,
    fillColor: "transparent",
    strokeWidth: 2,
    opacity: 1,
  };
}

function applyHighlightDefaults(element) {
  element.type = "highlight";
  element.strokeColor = DEFAULT_HIGHLIGHT_COLOR;
  element.fillColor = DEFAULT_HIGHLIGHT_COLOR;
  element.strokeWidth = 0;
  element.opacity = 0.45;
  return element;
}

function lineFromDrag(page, start, current, type) {
  return {
    id: createId(),
    type,
    page,
    x1: start.x,
    y1: start.y,
    x2: current.x,
    y2: current.y,
    strokeColor: DEFAULT_MARKUP_COLOR,
    strokeWidth: 3,
    opacity: 1,
  };
}

function getExportFontFamily(fontFamily) {
  return FONT_OPTIONS.find((font) => font.value === fontFamily)?.exportFamily || "Helvetica";
}

function rectGeometryFromPoints(start, current) {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  };
}

function updateMarqueeNode(node, rect) {
  node.style.left = `${rect.x * state.zoom}px`;
  node.style.top = `${rect.y * state.zoom}px`;
  node.style.width = `${rect.w * state.zoom}px`;
  node.style.height = `${rect.h * state.zoom}px`;
  node.dataset.x = String(rect.x);
  node.dataset.y = String(rect.y);
  node.dataset.w = String(rect.w);
  node.dataset.h = String(rect.h);
}

function parseMarqueeRect(node) {
  return {
    x: Number(node.dataset.x || 0),
    y: Number(node.dataset.y || 0),
    w: Number(node.dataset.w || 0),
    h: Number(node.dataset.h || 0),
  };
}

function getElementRect(element) {
  if (element.type === "line" || element.type === "arrow") {
    const bounds = getLineBounds(element);
    return { x: bounds.left, y: bounds.top, w: bounds.width, h: bounds.height };
  }
  return { x: element.x, y: element.y, w: element.w, h: element.h };
}

function rectsIntersect(a, b) {
  return a.x <= b.x + b.w
    && a.x + a.w >= b.x
    && a.y <= b.y + b.h
    && a.y + a.h >= b.y;
}

function moveElementFromOrigin(element, origin, dx, dy) {
  if (element.type === "line" || element.type === "arrow") {
    element.x1 = origin.x1 + dx;
    element.y1 = origin.y1 + dy;
    element.x2 = origin.x2 + dx;
    element.y2 = origin.y2 + dy;
    return;
  }
  element.x = Math.max(0, origin.x + dx);
  element.y = Math.max(0, origin.y + dy);
}

function numberField(prop, label, value, min = 0, max = 99999, step = 1) {
  return `
    <div class="field">
      <label for="prop-${prop}">${label}</label>
      <input id="prop-${prop}" data-prop="${prop}" type="number" min="${min}" max="${max}" step="${step}" value="${round(value)}">
    </div>
  `;
}

function rangeField(prop, label, value, min = 0, max = 1, step = 0.05) {
  const rounded = round(value);
  return `
    <div class="field span-2">
      <label for="prop-${prop}">${label}</label>
      <div class="range-number-row">
        <input id="prop-${prop}" data-prop="${prop}" data-pair="${prop}" data-value-type="number" type="range" min="${min}" max="${max}" step="${step}" value="${rounded}">
        <input id="prop-${prop}-number" data-prop="${prop}" data-pair="${prop}" data-value-type="number" type="number" min="${min}" max="${max}" step="${step}" value="${rounded}">
      </div>
    </div>
  `;
}

function colorField(prop, label, value) {
  return `
    <div class="field">
      <label for="prop-${prop}">${label}</label>
      <input id="prop-${prop}" data-prop="${prop}" type="color" value="${value === "transparent" ? "#ffffff" : value}">
    </div>
  `;
}

function option(value, current, label = value) {
  return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function eventToPdfPoint(event, overlay) {
  const rect = overlay.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.zoom,
    y: (event.clientY - rect.top) / state.zoom,
  };
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getLineBounds(element) {
  const padding = Math.max(10, (element.strokeWidth || 3) * 2);
  const left = Math.min(element.x1, element.x2) - padding;
  const top = Math.min(element.y1, element.y2) - padding;
  return {
    left,
    top,
    width: Math.abs(element.x2 - element.x1) + padding * 2,
    height: Math.abs(element.y2 - element.y1) + padding * 2,
  };
}

function arrowHeadPoints(x1, y1, x2, y2, size) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const left = {
    x: x2 - size * Math.cos(angle - Math.PI / 6),
    y: y2 - size * Math.sin(angle - Math.PI / 6),
  };
  const right = {
    x: x2 - size * Math.cos(angle + Math.PI / 6),
    y: y2 - size * Math.sin(angle + Math.PI / 6),
  };
  return [left, { x: x2, y: y2 }, right];
}

function findElement(id) {
  return state.elements.find((element) => element.id === id);
}

function getOverlay(pageNumber) {
  return els.pages.querySelector(`.page-overlay[data-page-number="${pageNumber}"]`);
}

function titleForElement(element) {
  const labels = { text: "Text box", image: "Image", rect: "Box", line: "Line", arrow: "Arrow", highlight: "Highlighter" };
  return labels[element.type] || "Object";
}

function hexToRgb(hex) {
  if (hex === "transparent") return rgb(1, 1, 1);
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean, 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function dataUrlToBytes(dataUrl) {
  return base64ToBytes(dataUrl.split(",")[1]);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateImageDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve();
      else reject(new Error("Image has no dimensions"));
    };
    image.onerror = () => reject(new Error("Image failed to decode"));
    image.src = dataUrl;
  });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 3200);
}

function createId() {
  return `obj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function baseName(fileName) {
  return fileName.replace(/\.[^.]+$/, "") || "document";
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
}

function syncLinkedInputs(input) {
  const pair = input.dataset.pair;
  if (!pair) return;
  els.inspectorContent.querySelectorAll(`[data-pair="${pair}"]`).forEach((linkedInput) => {
    if (linkedInput !== input) linkedInput.value = input.value;
  });
}

function focusTextElement(id) {
  const node = els.pages.querySelector(`.text-object[data-id="${id}"]`);
  if (!node) return;
  node.focus();
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function safeSetPointerCapture(element, pointerId) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic click paths can finish before pointer capture is available.
  }
}
