const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="sunriseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#fb7185" />
    </linearGradient>
    <linearGradient id="seaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#155e75" />
    </linearGradient>
    <clipPath id="waveClip">
      <rect x="0" y="312" width="960" height="328" rx="32" />
    </clipPath>
    <symbol id="starSymbol" viewBox="0 0 100 100">
      <path d="M50 10 61 37 90 37 66 55 76 84 50 66 24 84 34 55 10 37 39 37Z" fill="#fef3c7" />
    </symbol>
  </defs>
  <rect id="background" width="960" height="640" fill="#fffaf0" />
  <g id="posterFrame">
    <rect x="56" y="54" width="848" height="532" rx="40" fill="url(#sunriseGradient)" />
    <rect x="76" y="76" width="808" height="488" rx="30" fill="#fff8ee" opacity="0.16" />
  </g>
  <g id="hero">
    <circle id="sun" cx="728" cy="176" r="86" fill="#fde68a" opacity="0.72" />
    <path id="ridge" d="M90 382 C190 298, 290 312, 396 246 C522 168, 682 208, 866 118 L866 474 L90 474 Z" fill="#8b5e3c" opacity="0.88" />
    <g id="water" clip-path="url(#waveClip)">
      <rect x="0" y="312" width="960" height="328" fill="url(#seaGradient)" />
      <path id="waveFront" d="M0 382 C98 352, 208 438, 312 414 C420 390, 500 332, 612 350 C720 368, 830 444, 960 410 L960 640 L0 640 Z" fill="#7dd3fc" opacity="0.54" />
    </g>
    <g id="stars">
      <use href="#starSymbol" x="146" y="120" width="34" height="34" />
      <use href="#starSymbol" x="184" y="98" width="24" height="24" opacity="0.76" />
    </g>
  </g>
  <g id="label">
    <text id="title" x="110" y="154" font-size="58" font-family="Georgia, serif" fill="#fffaf0">HARBOR LIGHT</text>
    <text id="subtitle" x="114" y="198" font-size="24" font-family="Arial, sans-serif" letter-spacing="8" fill="#ffe7d0">COMPLEX SVG SAMPLE</text>
  </g>
</svg>
`.trim();

const FIELDS = [
  ["基础信息", [
    { key: "tagName", label: "元素类型", kind: "readonly", value: (node) => node.tagName.toLowerCase() },
    { key: "id", label: "元素 ID", kind: "attr" },
    { key: "class", label: "class", kind: "attr" },
    { key: "transform", label: "transform", kind: "attr" },
    { key: "opacity", label: "opacity", kind: "attr" }
  ]],
  ["视觉样式", [
    { key: "fill", label: "fill", kind: "attr" },
    { key: "stroke", label: "stroke", kind: "attr" },
    { key: "stroke-width", label: "stroke-width", kind: "attr" }
  ]],
  ["几何属性", [
    { key: "x", label: "x", kind: "attr" },
    { key: "y", label: "y", kind: "attr" },
    { key: "width", label: "width", kind: "attr" },
    { key: "height", label: "height", kind: "attr" },
    { key: "cx", label: "cx", kind: "attr" },
    { key: "cy", label: "cy", kind: "attr" },
    { key: "r", label: "r", kind: "attr" },
    { key: "rx", label: "rx", kind: "attr" },
    { key: "ry", label: "ry", kind: "attr" }
  ]],
  ["复杂数据", [
    { key: "d", label: "path d", kind: "attr", multiline: true },
    { key: "points", label: "points", kind: "attr", multiline: true },
    { key: "textContent", label: "文本内容", kind: "text", multiline: true }
  ]]
];

const state = {
  svgRoot: null,
  nodeMap: new Map(),
  selectedId: null,
  nextId: 0,
  zoom: 1,
  history: [],
  historyIndex: -1,
  restoring: false
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  fileInput: $("#fileInput"),
  importButton: $("#importButton"),
  loadSampleButton: $("#loadSampleButton"),
  applySourceButton: $("#applySourceButton"),
  exportButton: $("#exportButton"),
  undoButton: $("#undoButton"),
  redoButton: $("#redoButton"),
  duplicateButton: $("#duplicateButton"),
  deleteButton: $("#deleteButton"),
  zoomOutButton: $("#zoomOutButton"),
  zoomInButton: $("#zoomInButton"),
  zoomResetButton: $("#zoomResetButton"),
  zoomLabel: $("#zoomLabel"),
  statusPill: $("#statusPill"),
  workspaceMeta: $("#workspaceMeta"),
  nodeCountBadge: $("#nodeCountBadge"),
  treePanel: $("#treePanel"),
  resourceList: $("#resourceList"),
  svgHost: $("#svgHost"),
  overlay: $("#selectionOverlay"),
  sourceEditor: $("#sourceEditor"),
  propertyForm: $("#propertyForm"),
  inspectorEmpty: $("#inspectorEmpty"),
  fieldTemplate: $("#propertyFieldTemplate")
};

function parseSvg(source) {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const error = parsed.querySelector("parsererror");
  if (error) {
    throw new Error(error.textContent.trim() || "SVG 解析失败");
  }
  const root = parsed.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    throw new Error("导入内容不是有效的 SVG");
  }
  return root;
}

function addEditorIds(root) {
  const nodes = [root, ...root.querySelectorAll("*")];
  for (const node of nodes) {
    state.nextId += 1;
    node.dataset.editorId = `node-${state.nextId}`;
  }
}

function rebuildNodeMap() {
  state.nodeMap = new Map();
  if (!state.svgRoot) return;
  const nodes = [state.svgRoot, ...state.svgRoot.querySelectorAll("*")];
  nodes.forEach((node) => state.nodeMap.set(node.dataset.editorId, node));
}

function cleanForExport(root) {
  root.removeAttribute("data-editor-id");
  root.querySelectorAll("[data-editor-id]").forEach((node) => node.removeAttribute("data-editor-id"));
}

function serialize() {
  if (!state.svgRoot) return "";
  const clone = state.svgRoot.cloneNode(true);
  cleanForExport(clone);
  return new XMLSerializer().serializeToString(clone);
}

function labelFor(node) {
  const id = node.getAttribute("id");
  if (id) return `#${id}`;
  if (node.tagName.toLowerCase() === "text") return node.textContent.trim().slice(0, 24) || "<文本>";
  return "<未命名>";
}

function visibleField(node, field) {
  const tag = node.tagName.toLowerCase();
  if (field.kind === "readonly") return true;
  if (field.kind === "text") return ["text", "tspan"].includes(tag);
  if (field.key === "d") return tag === "path";
  if (field.key === "points") return ["polygon", "polyline"].includes(tag);
  if (["cx", "cy", "r"].includes(field.key)) return tag === "circle";
  if (["rx", "ry"].includes(field.key)) return ["rect", "ellipse"].includes(tag);
  if (["x", "y", "width", "height"].includes(field.key)) return ["rect", "text", "use", "image", "foreignObject"].includes(tag);
  return true;
}

function viewBoxFor(root) {
  if (root.getAttribute("viewBox")) return root.getAttribute("viewBox");
  try {
    const box = root.getBBox();
    if (box.width > 0 && box.height > 0) {
      return `${box.x} ${box.y} ${box.width} ${box.height}`;
    }
  } catch (error) {
    return "0 0 100 100";
  }
  return "0 0 100 100";
}

function resourceSummary(root) {
  return [
    ["Defs", root.querySelectorAll("defs").length, "复用定义容器"],
    ["Gradients", root.querySelectorAll("linearGradient, radialGradient").length, "渐变资源"],
    ["Symbols", root.querySelectorAll("symbol").length, "可复用图形"],
    ["Use", root.querySelectorAll("use").length, "实例节点"],
    ["Clips / Masks", root.querySelectorAll("clipPath, mask").length, "裁剪和蒙版"]
  ];
}

function recordHistory(reason) {
  if (!state.svgRoot || state.restoring) return;
  const snapshot = serialize();
  const previous = state.history[state.historyIndex]?.snapshot;
  if (snapshot === previous) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push({ reason, snapshot });
  if (state.history.length > 80) state.history.shift();
  state.historyIndex = state.history.length - 1;
  updateActions();
}

function restoreHistory(index) {
  const entry = state.history[index];
  if (!entry) return;
  state.restoring = true;
  loadDocument(entry.snapshot, false);
  state.historyIndex = index;
  state.restoring = false;
  updateActions();
}

function updateSource() {
  ui.sourceEditor.value = serialize();
}

function applyZoom() {
  ui.svgHost.style.transform = `scale(${state.zoom})`;
  ui.overlay.style.transform = `scale(${state.zoom})`;
  ui.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(value) {
  state.zoom = Math.max(0.3, Math.min(2.5, value));
  applyZoom();
}

function updateActions() {
  const active = state.nodeMap.get(state.selectedId);
  const canChange = Boolean(active && active !== state.svgRoot);
  ui.undoButton.disabled = state.historyIndex <= 0;
  ui.redoButton.disabled = state.historyIndex >= state.history.length - 1 || state.historyIndex < 0;
  ui.duplicateButton.disabled = !canChange;
  ui.deleteButton.disabled = !canChange;
}

function renderResources() {
  ui.resourceList.innerHTML = "";
  if (!state.svgRoot) return;
  resourceSummary(state.svgRoot).forEach(([title, count, detail]) => {
    const card = document.createElement("div");
    card.className = "resource-card";
    card.innerHTML = `<strong>${title}: ${count}</strong><span>${detail}</span>`;
    ui.resourceList.append(card);
  });
}

function renderTree() {
  ui.treePanel.innerHTML = "";
  if (!state.svgRoot) return;
  const fragment = document.createDocumentFragment();
  const walk = (node, depth) => {
    if (node.tagName.toLowerCase() === "style") return;
    const row = document.createElement("button");
    const dot = document.createElement("span");
    const tag = document.createElement("span");
    const label = document.createElement("span");
    row.type = "button";
    row.className = "tree-item";
    if (node.dataset.editorId === state.selectedId) row.classList.add("is-selected");
    row.style.paddingLeft = `${depth * 18 + 12}px`;
    dot.className = "tree-dot";
    tag.className = "tree-tag";
    label.className = "tree-label";
    tag.textContent = node.tagName.toLowerCase();
    label.textContent = labelFor(node);
    row.append(dot, tag, label);
    row.addEventListener("click", () => selectNode(node.dataset.editorId));
    fragment.append(row);
    [...node.children].forEach((child) => walk(child, depth + 1));
  };
  walk(state.svgRoot, 0);
  ui.treePanel.append(fragment);
  ui.nodeCountBadge.textContent = `${state.svgRoot.querySelectorAll("*").length + 1} 节点`;
}

function renderInspector() {
  const node = state.nodeMap.get(state.selectedId);
  if (!node) {
    ui.inspectorEmpty.classList.remove("hidden");
    ui.propertyForm.classList.add("hidden");
    ui.propertyForm.innerHTML = "";
    return;
  }
  ui.inspectorEmpty.classList.add("hidden");
  ui.propertyForm.classList.remove("hidden");
  ui.propertyForm.innerHTML = "";
  FIELDS.forEach(([title, fields]) => {
    const heading = document.createElement("h3");
    heading.className = "section-title";
    heading.textContent = title;
    ui.propertyForm.append(heading);
    fields.forEach((field) => {
      if (!visibleField(node, field)) return;
      const row = ui.fieldTemplate.content.firstElementChild.cloneNode(true);
      const label = row.querySelector(".field-label");
      const originalInput = row.querySelector(".field-input");
      const input = field.multiline ? document.createElement("textarea") : originalInput;
      if (field.multiline) {
        input.className = originalInput.className;
        originalInput.replaceWith(input);
      }
      label.textContent = field.label;
      input.value = field.kind === "readonly" ? field.value(node) : field.kind === "text" ? (node.textContent ?? "") : (node.getAttribute(field.key) ?? "");
      if (field.kind === "readonly") input.readOnly = true;
      const commit = () => updateField(node.dataset.editorId, field, input.value, true);
      input.addEventListener("input", () => updateField(node.dataset.editorId, field, input.value, false));
      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);
      ui.propertyForm.append(row);
    });
  });
}

function renderOverlay() {
  ui.overlay.innerHTML = "";
  const node = state.nodeMap.get(state.selectedId);
  if (!node) {
    ui.statusPill.textContent = "未选择元素";
    return;
  }
  ui.statusPill.textContent = `${node.tagName.toLowerCase()} ${labelFor(node)}`;
  if (node === state.svgRoot) return;
  try {
    const box = node.getBBox();
    if (!box.width || !box.height) return;
    const padding = Math.max(2, Math.min(box.width, box.height) * 0.03);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(box.x - padding));
    rect.setAttribute("y", String(box.y - padding));
    rect.setAttribute("width", String(box.width + padding * 2));
    rect.setAttribute("height", String(box.height + padding * 2));
    rect.setAttribute("rx", "8");
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", "#0f766e");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("stroke-dasharray", "10 8");
    ui.overlay.append(rect);
  } catch (error) {
    ui.statusPill.textContent = `${node.tagName.toLowerCase()} 已选中`;
  }
}

function selectNode(editorId) {
  state.selectedId = editorId;
  renderTree();
  renderInspector();
  renderOverlay();
  updateActions();
}

function renderWorkspace() {
  ui.svgHost.innerHTML = "";
  ui.overlay.innerHTML = "";
  if (!state.svgRoot) return;
  ui.svgHost.append(state.svgRoot);
  ui.overlay.setAttribute("viewBox", viewBoxFor(state.svgRoot));
  ui.overlay.setAttribute("preserveAspectRatio", state.svgRoot.getAttribute("preserveAspectRatio") || "xMidYMid meet");
  state.svgRoot.addEventListener("click", (event) => {
    const target = event.target.closest("[data-editor-id]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    selectNode(target.dataset.editorId);
  });
  ui.workspaceMeta.textContent = `已载入 ${state.svgRoot.querySelectorAll("*").length + 1} 个节点`;
  applyZoom();
  renderOverlay();
}

function updateField(editorId, field, value, record) {
  const node = state.nodeMap.get(editorId);
  if (!node || field.kind === "readonly") return;
  if (field.kind === "text") {
    node.textContent = value;
  } else if (value.trim()) {
    node.setAttribute(field.key, value.trim());
  } else {
    node.removeAttribute(field.key);
  }
  updateSource();
  renderTree();
  renderOverlay();
  if (record) renderInspector();
  if (record) recordHistory(`field:${field.key}`);
}

function normalizeCloneIds(root) {
  [root, ...root.querySelectorAll("*")].forEach((node) => {
    if (node.hasAttribute("id")) node.setAttribute("id", `${node.getAttribute("id")}-copy`);
  });
}

function duplicateSelection() {
  const node = state.nodeMap.get(state.selectedId);
  if (!node || node === state.svgRoot || !node.parentNode) return;
  const clone = node.cloneNode(true);
  normalizeCloneIds(clone);
  addEditorIds(clone);
  node.parentNode.insertBefore(clone, node.nextSibling);
  rebuildNodeMap();
  renderTree();
  renderResources();
  updateSource();
  selectNode(clone.dataset.editorId);
  recordHistory("duplicate");
}

function deleteSelection() {
  const node = state.nodeMap.get(state.selectedId);
  if (!node || node === state.svgRoot || !node.parentNode) return;
  const fallback = node.previousElementSibling || node.parentElement || state.svgRoot;
  node.remove();
  rebuildNodeMap();
  renderResources();
  updateSource();
  renderTree();
  recordHistory("delete");
  selectNode(fallback.dataset.editorId);
}

function downloadSvg() {
  const url = URL.createObjectURL(new Blob([serialize()], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "edited-graphic.svg";
  link.click();
  URL.revokeObjectURL(url);
}

function loadDocument(source, pushHistory = true) {
  const root = parseSvg(source);
  addEditorIds(root);
  state.svgRoot = root;
  rebuildNodeMap();
  renderWorkspace();
  renderTree();
  renderResources();
  updateSource();
  selectNode(root.dataset.editorId);
  if (pushHistory) recordHistory("load");
  else updateActions();
}

ui.importButton.addEventListener("click", () => ui.fileInput.click());
ui.loadSampleButton.addEventListener("click", () => loadDocument(SAMPLE_SVG));
ui.applySourceButton.addEventListener("click", () => {
  try {
    loadDocument(ui.sourceEditor.value);
  } catch (error) {
    alert(error.message);
  }
});
ui.exportButton.addEventListener("click", downloadSvg);
ui.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    loadDocument(await file.text());
    event.target.value = "";
  } catch (error) {
    alert(error.message);
  }
});
ui.undoButton.addEventListener("click", () => restoreHistory(state.historyIndex - 1));
ui.redoButton.addEventListener("click", () => restoreHistory(state.historyIndex + 1));
ui.duplicateButton.addEventListener("click", duplicateSelection);
ui.deleteButton.addEventListener("click", deleteSelection);
ui.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.1));
ui.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.1));
ui.zoomResetButton.addEventListener("click", () => setZoom(1));
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    restoreHistory(event.shiftKey ? state.historyIndex + 1 : state.historyIndex - 1);
  }
  const editable = document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']");
  if ((event.key === "Delete" || event.key === "Backspace") && !editable) {
    deleteSelection();
  }
});

loadDocument(SAMPLE_SVG);
