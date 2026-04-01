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

const EMPTY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <rect id="canvasBackground" x="0" y="0" width="1200" height="800" fill="#fffdf8" />
</svg>
`.trim();

const FIELDS = [
  ["Basics", [
    { key: "tagName", label: "Element type", kind: "readonly", value: (node) => node.tagName.toLowerCase() },
    { key: "id", label: "Element ID", kind: "attr" },
    { key: "class", label: "class", kind: "attr" },
    { key: "transform", label: "transform", kind: "attr" },
    { key: "opacity", label: "opacity", kind: "attr" }
  ]],
  ["Appearance", [
    { key: "fill", label: "fill", kind: "attr" },
    { key: "stroke", label: "stroke", kind: "attr" },
    { key: "stroke-width", label: "stroke-width", kind: "attr" }
  ]],
  ["Geometry", [
    { key: "x", label: "x", kind: "attr" },
    { key: "y", label: "y", kind: "attr" },
    { key: "width", label: "width", kind: "attr" },
    { key: "height", label: "height", kind: "attr" },
    { key: "x1", label: "x1", kind: "attr" },
    { key: "y1", label: "y1", kind: "attr" },
    { key: "x2", label: "x2", kind: "attr" },
    { key: "y2", label: "y2", kind: "attr" },
    { key: "cx", label: "cx", kind: "attr" },
    { key: "cy", label: "cy", kind: "attr" },
    { key: "r", label: "r", kind: "attr" },
    { key: "rx", label: "rx", kind: "attr" },
    { key: "ry", label: "ry", kind: "attr" }
  ]],
  ["Advanced", [
    { key: "d", label: "path d", kind: "attr", multiline: true },
    { key: "points", label: "points", kind: "attr", multiline: true },
    { key: "textContent", label: "text content", kind: "text", multiline: true }
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
  restoring: false,
  drag: null,
  dropDepth: 0,
  warnings: []
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  fileInput: $("#fileInput"),
  imageInput: $("#imageInput"),
  importButton: $("#importButton"),
  sourceToggleButton: $("#sourceToggleButton"),
  closeSourceButton: $("#closeSourceButton"),
  insertImageButton: $("#insertImageButton"),
  newDocumentButton: $("#newDocumentButton"),
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
  insertGrid: $("#insertGrid"),
  workspaceSurface: $("#workspaceSurface"),
  dropOverlay: $("#dropOverlay"),
  sourceModalBackdrop: $("#sourceModalBackdrop"),
  sourceModal: $("#sourceModal"),
  sourceEditor: $("#sourceEditor"),
  propertyForm: $("#propertyForm"),
  inspectorEmpty: $("#inspectorEmpty"),
  fieldTemplate: $("#propertyFieldTemplate")
};

const DANGEROUS_TAGS = new Set(["script", "foreignobject", "iframe", "object", "embed"]);
const REFERENCE_ATTRS = new Set([
  "href",
  "xlink:href",
  "clip-path",
  "mask",
  "filter",
  "fill",
  "stroke",
  "marker-start",
  "marker-mid",
  "marker-end",
  "begin",
  "end",
  "style"
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeDomId(value, fallback = "node") {
  const normalized = (value || fallback)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_.:-]/g, "-")
    .replace(/^-+/, "");

  return normalized || fallback;
}

function getUsedDomIds(excludeNode = null) {
  const used = new Set();
  if (!state.svgRoot) {
    return used;
  }

  for (const node of state.svgRoot.querySelectorAll("[id]")) {
    if (excludeNode && node === excludeNode) {
      continue;
    }
    used.add(node.getAttribute("id"));
  }

  if (state.svgRoot.hasAttribute("id") && state.svgRoot !== excludeNode) {
    used.add(state.svgRoot.getAttribute("id"));
  }

  return used;
}

function makeUniqueDomId(base, usedIds) {
  const normalizedBase = sanitizeDomId(base);
  if (!usedIds.has(normalizedBase)) {
    usedIds.add(normalizedBase);
    return normalizedBase;
  }

  let index = 1;
  while (usedIds.has(`${normalizedBase}-${index}`)) {
    index += 1;
  }

  const nextId = `${normalizedBase}-${index}`;
  usedIds.add(nextId);
  return nextId;
}

function replaceIdReferencesInValue(value, idMap) {
  let nextValue = value;

  for (const [oldId, newId] of idMap.entries()) {
    const escaped = escapeRegExp(oldId);
    nextValue = nextValue.replace(new RegExp(`url\\((['"]?)#${escaped}\\1\\)`, "g"), `url(#${newId})`);
    nextValue = nextValue.replace(new RegExp(`^#${escaped}$`, "g"), `#${newId}`);
    nextValue = nextValue.replace(new RegExp(`([;\\s(,])#${escaped}(?=\\b|[;\\s),])`, "g"), `$1#${newId}`);
  }

  return nextValue;
}

function rewriteNodeReferences(node, idMap) {
  for (const attrName of node.getAttributeNames()) {
    const currentValue = node.getAttribute(attrName);
    if (!currentValue) {
      continue;
    }

    if (REFERENCE_ATTRS.has(attrName) || currentValue.includes("url(#") || currentValue.startsWith("#")) {
      const nextValue = replaceIdReferencesInValue(currentValue, idMap);
      if (nextValue !== currentValue) {
        node.setAttribute(attrName, nextValue);
      }
    }
  }
}

function rewriteDocumentReferences(idMap) {
  if (!state.svgRoot || !idMap.size) {
    return;
  }

  const nodes = [state.svgRoot, ...state.svgRoot.querySelectorAll("*")];
  for (const node of nodes) {
    rewriteNodeReferences(node, idMap);
  }
}

function remapSubtreeIds(root) {
  const usedIds = getUsedDomIds();
  const idMap = new Map();
  const nodes = [root, ...root.querySelectorAll("*")];

  for (const node of nodes) {
    const oldId = node.getAttribute("id");
    if (!oldId) {
      continue;
    }

    const nextId = makeUniqueDomId(oldId, usedIds);
    idMap.set(oldId, nextId);
    node.setAttribute("id", nextId);
  }

  for (const node of nodes) {
    rewriteNodeReferences(node, idMap);
  }
}

function renameNodeId(node, requestedId) {
  const fallbackBase = node.tagName.toLowerCase();
  const oldId = node.getAttribute("id");
  const usedIds = getUsedDomIds(node);
  const nextId = makeUniqueDomId(requestedId || fallbackBase, usedIds);

  node.setAttribute("id", nextId);

  if (oldId && oldId !== nextId) {
    rewriteDocumentReferences(new Map([[oldId, nextId]]));
  }

  return nextId;
}

function isSafeHref(value) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("#") || normalized.startsWith("data:");
}

function sanitizeCssText(value) {
  if (/@import/i.test(value) || /javascript:/i.test(value) || /expression\s*\(/i.test(value)) {
    return "";
  }

  return value.replace(/url\((.*?)\)/gi, (match, inner) => {
    const normalized = inner.trim().replace(/^['"]|['"]$/g, "");
    return normalized.startsWith("#") ? `url(#${normalized.slice(1)})` : "";
  });
}

function sanitizeSvgTree(root) {
  const warnings = [];

  for (const node of [root, ...root.querySelectorAll("*")]) {
    const tag = node.tagName.toLowerCase();

    if (DANGEROUS_TAGS.has(tag)) {
      warnings.push(`Removed unsafe tag <${tag}>`);
      node.remove();
      continue;
    }

    if (tag === "style") {
      const sanitizedStyle = sanitizeCssText(node.textContent || "");
      if (!sanitizedStyle.trim()) {
        warnings.push("Removed a <style> block with external or executable content");
        node.remove();
        continue;
      }
      node.textContent = sanitizedStyle;
    }

    for (const attrName of node.getAttributeNames()) {
      const value = node.getAttribute(attrName) || "";

      if (attrName.toLowerCase().startsWith("on")) {
        warnings.push(`Removed event attribute ${attrName}`);
        node.removeAttribute(attrName);
        continue;
      }

      if (["href", "xlink:href", "src"].includes(attrName) && !isSafeHref(value)) {
        warnings.push(`Removed external reference attribute ${attrName}`);
        node.removeAttribute(attrName);
        continue;
      }

      if (attrName === "style") {
        const sanitizedStyle = sanitizeCssText(value);
        if (!sanitizedStyle.trim()) {
          warnings.push("Removed unsafe style attribute");
          node.removeAttribute(attrName);
        } else if (sanitizedStyle !== value) {
          node.setAttribute(attrName, sanitizedStyle);
        }
        continue;
      }

      if (value.includes("url(") && !/^url\(\s*['"]?#/i.test(value.trim())) {
        const sanitizedValue = sanitizeCssText(value);
        if (!sanitizedValue.trim()) {
          warnings.push(`Removed unsafe reference attribute ${attrName}`);
          node.removeAttribute(attrName);
        } else {
          node.setAttribute(attrName, sanitizedValue);
        }
      }
    }
  }

  return warnings;
}

function parseSvg(source) {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const error = parsed.querySelector("parsererror");
  if (error) {
    throw new Error(error.textContent.trim() || "Failed to parse SVG");
  }
  const root = parsed.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    throw new Error("Imported content is not valid SVG");
  }
  state.warnings = sanitizeSvgTree(root);
  return root;
}

function ensureDocument() {
  if (!state.svgRoot) {
    loadDocument(EMPTY_SVG);
  }
  return state.svgRoot;
}

function getViewBoxRect() {
  const root = ensureDocument();
  const baseVal = root.viewBox?.baseVal;
  if (baseVal && baseVal.width && baseVal.height) {
    return {
      x: baseVal.x,
      y: baseVal.y,
      width: baseVal.width,
      height: baseVal.height
    };
  }

  return { x: 0, y: 0, width: 1200, height: 800 };
}

function getInsertParent() {
  const root = ensureDocument();
  const selected = state.nodeMap.get(state.selectedId);
  if (!selected || selected === root) {
    return root;
  }

  const tag = selected.tagName.toLowerCase();
  if (["g", "svg"].includes(tag)) {
    return selected;
  }

  if (["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient"].includes(tag)) {
    return root;
  }

  return selected.parentElement || root;
}

function nextNodeName(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createElementNode(kind) {
  const box = getViewBoxRect();
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const svgNs = "http://www.w3.org/2000/svg";
  const node = document.createElementNS(svgNs, kind);

  if (kind === "rect") {
    node.setAttribute("id", nextNodeName("rect"));
    node.setAttribute("x", String(centerX - 90));
    node.setAttribute("y", String(centerY - 60));
    node.setAttribute("width", "180");
    node.setAttribute("height", "120");
    node.setAttribute("rx", "20");
    node.setAttribute("fill", "#f97316");
    node.setAttribute("opacity", "0.92");
  }

  if (kind === "circle") {
    node.setAttribute("id", nextNodeName("circle"));
    node.setAttribute("cx", String(centerX));
    node.setAttribute("cy", String(centerY));
    node.setAttribute("r", "68");
    node.setAttribute("fill", "#0f766e");
    node.setAttribute("opacity", "0.92");
  }

  if (kind === "ellipse") {
    node.setAttribute("id", nextNodeName("ellipse"));
    node.setAttribute("cx", String(centerX));
    node.setAttribute("cy", String(centerY));
    node.setAttribute("rx", "110");
    node.setAttribute("ry", "62");
    node.setAttribute("fill", "#38bdf8");
    node.setAttribute("opacity", "0.88");
  }

  if (kind === "line") {
    node.setAttribute("id", nextNodeName("line"));
    node.setAttribute("x1", String(centerX - 120));
    node.setAttribute("y1", String(centerY - 60));
    node.setAttribute("x2", String(centerX + 120));
    node.setAttribute("y2", String(centerY + 60));
    node.setAttribute("stroke", "#24180f");
    node.setAttribute("stroke-width", "10");
    node.setAttribute("stroke-linecap", "round");
  }

  if (kind === "text") {
    node.setAttribute("id", nextNodeName("text"));
    node.setAttribute("x", String(centerX - 110));
    node.setAttribute("y", String(centerY));
    node.setAttribute("fill", "#24180f");
    node.setAttribute("font-size", "42");
    node.setAttribute("font-family", "IBM Plex Sans, Segoe UI, sans-serif");
    node.textContent = "New text";
  }

  return node;
}

function insertNode(node, recordReason = "insert") {
  const parent = getInsertParent();
  addEditorIds(node);
  parent.append(node);
  rebuildNodeMap();
  renderWorkspace();
  renderTree();
  renderResources();
  updateSource();
  selectNode(node.dataset.editorId);
  recordHistory(recordReason);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function measureImage(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || 320,
      height: image.naturalHeight || 200
    });
    image.onerror = () => resolve({ width: 320, height: 200 });
    image.src = dataUrl;
  });
}

async function insertImageFile(file) {
  ensureDocument();
  const box = getViewBoxRect();
  const dataUrl = await readFileAsDataUrl(file);
  const size = await measureImage(dataUrl);
  const maxWidth = Math.max(180, box.width * 0.38);
  const scale = Math.min(1, maxWidth / size.width);
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const imageNode = document.createElementNS("http://www.w3.org/2000/svg", "image");

  imageNode.setAttribute("id", nextNodeName("image"));
  imageNode.setAttribute("x", String(centerX - width / 2));
  imageNode.setAttribute("y", String(centerY - height / 2));
  imageNode.setAttribute("width", String(width));
  imageNode.setAttribute("height", String(height));
  imageNode.setAttribute("preserveAspectRatio", "xMidYMid meet");
  imageNode.setAttribute("href", dataUrl);

  insertNode(imageNode, "insert-image");
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
  if (node.tagName.toLowerCase() === "text") return node.textContent.trim().slice(0, 24) || "<text>";
  return "<unnamed>";
}

function visibleField(node, field) {
  const tag = node.tagName.toLowerCase();
  if (field.kind === "readonly") return true;
  if (field.kind === "text") return ["text", "tspan"].includes(tag);
  if (field.key === "d") return tag === "path";
  if (field.key === "points") return ["polygon", "polyline"].includes(tag);
  if (["cx", "cy", "r"].includes(field.key)) return tag === "circle";
  if (["rx", "ry"].includes(field.key)) return ["rect", "ellipse"].includes(tag);
  if (["x1", "y1", "x2", "y2"].includes(field.key)) return tag === "line";
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
    ["Defs", root.querySelectorAll("defs").length, "Reusable definition containers"],
    ["Gradients", root.querySelectorAll("linearGradient, radialGradient").length, "Gradient assets"],
    ["Symbols", root.querySelectorAll("symbol").length, "Reusable symbols"],
    ["Use", root.querySelectorAll("use").length, "Instanced nodes"],
    ["Clips / Masks", root.querySelectorAll("clipPath, mask").length, "Clip and mask resources"]
  ];
}

function canDragNode(node) {
  if (!node || node === state.svgRoot) return false;
  const tag = node.tagName.toLowerCase();
  return !["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient", "stop"].includes(tag);
}

function getNumericAttr(node, attrName, fallback = 0) {
  const value = Number.parseFloat(node.getAttribute(attrName));
  return Number.isFinite(value) ? value : fallback;
}

function toLocalPoint(referenceNode, clientX, clientY) {
  const point = state.svgRoot.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = referenceNode.getScreenCTM();
  if (!matrix) {
    return { x: clientX, y: clientY };
  }
  return point.matrixTransform(matrix.inverse());
}

function getDragDescriptor(node) {
  const tag = node.tagName.toLowerCase();

  if (["rect", "image", "foreignObject", "use", "text"].includes(tag)) {
    return {
      mode: "xy",
      x: getNumericAttr(node, "x"),
      y: getNumericAttr(node, "y")
    };
  }

  if (["circle", "ellipse"].includes(tag)) {
    return {
      mode: "center",
      cx: getNumericAttr(node, "cx"),
      cy: getNumericAttr(node, "cy")
    };
  }

  if (tag === "line") {
    return {
      mode: "line",
      x1: getNumericAttr(node, "x1"),
      y1: getNumericAttr(node, "y1"),
      x2: getNumericAttr(node, "x2"),
      y2: getNumericAttr(node, "y2")
    };
  }

  return {
    mode: "transform",
    baseMatrix: node.transform?.baseVal?.consolidate()?.matrix || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  };
}

function applyDrag(node, descriptor, dx, dy) {
  if (descriptor.mode === "xy") {
    node.setAttribute("x", String(descriptor.x + dx));
    node.setAttribute("y", String(descriptor.y + dy));
    return;
  }

  if (descriptor.mode === "center") {
    node.setAttribute("cx", String(descriptor.cx + dx));
    node.setAttribute("cy", String(descriptor.cy + dy));
    return;
  }

  if (descriptor.mode === "line") {
    node.setAttribute("x1", String(descriptor.x1 + dx));
    node.setAttribute("y1", String(descriptor.y1 + dy));
    node.setAttribute("x2", String(descriptor.x2 + dx));
    node.setAttribute("y2", String(descriptor.y2 + dy));
    return;
  }

  const { a, b, c, d, e, f } = descriptor.baseMatrix;
  node.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e + dx} ${f + dy})`);
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

function closeSourceModal(restoreFocus = true) {
  ui.sourceModalBackdrop.classList.add("hidden");
  ui.sourceToggleButton.classList.remove("is-active");
  ui.sourceToggleButton.setAttribute("aria-expanded", "false");
  ui.sourceToggleButton.title = "Open source editor";
  document.body.classList.remove("modal-open");

  if (restoreFocus) {
    ui.sourceToggleButton.focus();
  }
}

function openSourceModal() {
  updateSource();
  ui.sourceModalBackdrop.classList.remove("hidden");
  ui.sourceToggleButton.classList.add("is-active");
  ui.sourceToggleButton.setAttribute("aria-expanded", "true");
  ui.sourceToggleButton.title = "Close source editor";
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => ui.sourceEditor.focus());
}

function applyZoom() {
  ui.svgHost.style.transform = `scale(${state.zoom})`;
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
  ui.nodeCountBadge.textContent = `${state.svgRoot.querySelectorAll("*").length + 1} nodes`;
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
      if (field.key !== "id") {
        input.addEventListener("input", () => updateField(node.dataset.editorId, field, input.value, false));
      }
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
    ui.statusPill.textContent = "No selection";
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
    ui.statusPill.textContent = `${node.tagName.toLowerCase()} selected`;
  }
}

function clearDropState() {
  state.dropDepth = 0;
  ui.workspaceSurface.classList.remove("is-dropping");
  ui.dropOverlay.classList.add("hidden");
}

function beginDrag(node, event) {
  if (!canDragNode(node)) return;

  const referenceNode = node.parentElement || state.svgRoot;
  const startPoint = toLocalPoint(referenceNode, event.clientX, event.clientY);
  state.drag = {
    editorId: node.dataset.editorId,
    descriptor: getDragDescriptor(node),
    startPoint,
    referenceNode
  };
  ui.statusPill.textContent = `Dragging: ${node.tagName.toLowerCase()} ${labelFor(node)}`;
}

function moveDrag(event) {
  if (!state.drag) return;
  const node = state.nodeMap.get(state.drag.editorId);
  if (!node) return;

  const currentPoint = toLocalPoint(state.drag.referenceNode, event.clientX, event.clientY);
  const dx = Math.round((currentPoint.x - state.drag.startPoint.x) * 100) / 100;
  const dy = Math.round((currentPoint.y - state.drag.startPoint.y) * 100) / 100;
  applyDrag(node, state.drag.descriptor, dx, dy);
  updateSource();
  renderOverlay();
}

function endDrag() {
  if (!state.drag) return;
  renderInspector();
  renderOverlay();
  recordHistory("drag");
  state.drag = null;
}

async function handleWorkspaceFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;

  for (const file of files) {
    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    const isImage = file.type.startsWith("image/") || isSvg;

    if (!isImage) {
      continue;
    }

    await insertImageFile(file);
  }
}

function onSvgClick(event) {
  const target = event.target.closest("[data-editor-id]");
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  selectNode(target.dataset.editorId);
}

function onSvgPointerDown(event) {
  if (event.button !== 0) return;
  const target = event.target.closest("[data-editor-id]");
  if (!target) return;
  selectNode(target.dataset.editorId);
  beginDrag(target, event);
}

function selectNode(editorId) {
  state.selectedId = editorId;
  renderTree();
  renderInspector();
  renderOverlay();
  updateActions();
}

function renderWorkspace() {
  ui.overlay.innerHTML = "";
  if (!state.svgRoot) return;
  state.svgRoot.classList.add("workspace-svg");
  const viewBox = getViewBoxRect();
  ui.svgHost.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
  const currentSvg = ui.svgHost.querySelector(".workspace-svg");
  if (currentSvg && currentSvg !== state.svgRoot) {
    currentSvg.remove();
  }
  ui.svgHost.prepend(state.svgRoot);
  ui.svgHost.append(ui.overlay);
  ui.overlay.setAttribute("viewBox", viewBoxFor(state.svgRoot));
  ui.overlay.setAttribute("preserveAspectRatio", state.svgRoot.getAttribute("preserveAspectRatio") || "xMidYMid meet");
  state.svgRoot.removeEventListener("click", onSvgClick);
  state.svgRoot.removeEventListener("pointerdown", onSvgPointerDown);
  state.svgRoot.addEventListener("click", onSvgClick);
  state.svgRoot.addEventListener("pointerdown", onSvgPointerDown);
  const warningSuffix = state.warnings.length ? `, removed ${state.warnings.length} unsafe item(s)` : "";
  ui.workspaceMeta.textContent = `Loaded ${state.svgRoot.querySelectorAll("*").length + 1} nodes${warningSuffix}`;
  applyZoom();
  renderOverlay();
}

function updateField(editorId, field, value, record) {
  const node = state.nodeMap.get(editorId);
  if (!node || field.kind === "readonly") return;
  if (field.key === "id") {
    if (!record) return;
    renameNodeId(node, value.trim());
    updateSource();
    renderTree();
    renderOverlay();
    renderInspector();
    recordHistory("field:id");
    return;
  }
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

function duplicateSelection() {
  const node = state.nodeMap.get(state.selectedId);
  if (!node || node === state.svgRoot || !node.parentNode) return;
  const clone = node.cloneNode(true);
  remapSubtreeIds(clone);
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
ui.sourceToggleButton.addEventListener("click", () => {
  if (ui.sourceModalBackdrop.classList.contains("hidden")) {
    openSourceModal();
  } else {
    closeSourceModal();
  }
});
ui.closeSourceButton.addEventListener("click", () => closeSourceModal());
ui.insertImageButton.addEventListener("click", () => ui.imageInput.click());
ui.newDocumentButton.addEventListener("click", () => loadDocument(EMPTY_SVG));
ui.loadSampleButton.addEventListener("click", () => loadDocument(SAMPLE_SVG));
ui.applySourceButton.addEventListener("click", () => {
  try {
    loadDocument(ui.sourceEditor.value);
    closeSourceModal();
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
ui.imageInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    await insertImageFile(file);
    event.target.value = "";
  } catch (error) {
    alert(error.message);
  }
});
ui.insertGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-insert]");
  if (!button) return;
  insertNode(createElementNode(button.dataset.insert), `insert-${button.dataset.insert}`);
});
ui.undoButton.addEventListener("click", () => restoreHistory(state.historyIndex - 1));
ui.redoButton.addEventListener("click", () => restoreHistory(state.historyIndex + 1));
ui.duplicateButton.addEventListener("click", duplicateSelection);
ui.deleteButton.addEventListener("click", deleteSelection);
ui.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.1));
ui.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.1));
ui.zoomResetButton.addEventListener("click", () => setZoom(1));
ui.workspaceSurface.addEventListener("dragenter", (event) => {
  event.preventDefault();
  state.dropDepth += 1;
  ui.workspaceSurface.classList.add("is-dropping");
  ui.dropOverlay.classList.remove("hidden");
});
ui.workspaceSurface.addEventListener("dragover", (event) => {
  event.preventDefault();
});
ui.workspaceSurface.addEventListener("dragleave", (event) => {
  event.preventDefault();
  state.dropDepth = Math.max(0, state.dropDepth - 1);
  if (state.dropDepth === 0) {
    clearDropState();
  }
});
ui.workspaceSurface.addEventListener("drop", async (event) => {
  event.preventDefault();
  clearDropState();
  try {
    await handleWorkspaceFiles(event.dataTransfer?.files || []);
  } catch (error) {
    alert(error.message);
  }
});
ui.sourceModalBackdrop.addEventListener("click", (event) => {
  if (event.target === ui.sourceModalBackdrop) {
    closeSourceModal(false);
  }
});
window.addEventListener("pointermove", (event) => {
  moveDrag(event);
});
window.addEventListener("pointerup", () => {
  endDrag();
});
window.addEventListener("pointercancel", () => {
  endDrag();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.sourceModalBackdrop.classList.contains("hidden")) {
    closeSourceModal();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    restoreHistory(event.shiftKey ? state.historyIndex + 1 : state.historyIndex - 1);
  }
  const editable = document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']");
  if ((event.key === "Delete" || event.key === "Backspace") && !editable) {
    deleteSelection();
  }
});

closeSourceModal(false);
loadDocument(SAMPLE_SVG);
