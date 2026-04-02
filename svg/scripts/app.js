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
    { key: "stroke-width", label: "stroke-width", kind: "attr" },
    { key: "font-size", label: "font-size", kind: "attr" },
    { key: "font-family", label: "font-family", kind: "attr" }
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

const FIELD_MAP = new Map(FIELDS.flatMap(([, fields]) => fields.map((field) => [field.key, field])));
const NUMERIC_FIELDS = new Set(["opacity", "stroke-width", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "font-size"]);
const COLOR_FIELDS = new Set(["fill", "stroke"]);
const GRID_SCREEN_SIZE = 28;
const GRID_SNAP_STORAGE_KEY = "svgStudio.gridSnap";
const COMMON_FONT_OPTIONS = [
  { label: "Document default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS, Helvetica, sans-serif" },
  { label: "Segoe UI", value: "Segoe UI, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, Times New Roman, serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Courier New", value: "Courier New, Courier, monospace" },
  { label: "Lucida Console", value: "Lucida Console, Monaco, monospace" },
  { label: "PingFang SC", value: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" },
  { label: "Microsoft YaHei", value: "Microsoft YaHei, PingFang SC, sans-serif" },
  { label: "Noto Sans SC", value: "Noto Sans SC, Microsoft YaHei, sans-serif" },
  { label: "SimSun", value: "SimSun, Songti SC, serif" }
];

function readStoredBoolean(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch (error) {
    return fallback;
  }
  return fallback;
}

const state = {
  svgRoot: null,
  nodeMap: new Map(),
  selectedId: null,
  nextId: 0,
  zoom: 1,
  gridSnapEnabled: readStoredBoolean(GRID_SNAP_STORAGE_KEY, false),
  topbarCollapsed: false,
  leftPanelHidden: false,
  rightPanelHidden: false,
  sourceVisible: false,
  history: [],
  historyIndex: -1,
  restoring: false,
  drag: null,
  dropDepth: 0,
  warnings: [],
  collapsedNodes: new Set()
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  appShell: $("#appShell"),
  topbar: $("#topbar"),
  leftPanel: $("#leftPanel"),
  rightPanel: $("#rightPanel"),
  fileInput: $("#fileInput"),
  imageInput: $("#imageInput"),
  importButton: $("#importButton"),
  gridSnapButton: $("#gridSnapButton"),
  sourceToggleButton: $("#sourceToggleButton"),
  collapseTopbarButton: $("#collapseTopbarButton"),
  showTopbarButton: $("#showTopbarButton"),
  hideLeftPanelButton: $("#hideLeftPanelButton"),
  hideRightPanelButton: $("#hideRightPanelButton"),
  floatingLeftButton: $("#floatingLeftButton"),
  floatingRightButton: $("#floatingRightButton"),
  insertImageButton: $("#insertImageButton"),
  newDocumentButton: $("#newDocumentButton"),
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
  nodeCountBadge: $("#nodeCountBadge"),
  treePanel: $("#treePanel"),
  svgHost: $("#svgHost"),
  overlay: $("#selectionOverlay"),
  insertGrid: $("#insertGrid"),
  workspaceSurface: $("#workspaceSurface"),
  workspaceContent: $("#workspaceContent"),
  dropOverlay: $("#dropOverlay"),
  sourcePane: $("#sourcePane"),
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

function getRenderableChildren(node) {
  return [...node.children].filter((child) => child.tagName.toLowerCase() !== "style");
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

  if (isNodeLocked(selected)) {
    return selected.parentElement || root;
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
  snapNodeToGrid(node);
  addEditorIds(node);
  parent.append(node);
  rebuildNodeMap();
  renderWorkspace();
  renderTree();
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
  const nodes = [root, ...root.querySelectorAll("*")];
  for (const node of nodes) {
    for (const attrName of node.getAttributeNames()) {
      if (attrName.startsWith("data-editor-")) {
        node.removeAttribute(attrName);
      }
    }
  }
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

function isNodeLocked(node) {
  return node?.dataset.editorLocked === "true";
}

function isNodeHidden(node) {
  return node?.getAttribute("display") === "none";
}

function visibleField(node, field) {
  const tag = node.tagName.toLowerCase();
  if (field.kind === "readonly") return true;
  if (field.kind === "text") return ["text", "tspan"].includes(tag);
  if (field.key === "d") return tag === "path";
  if (field.key === "points") return ["polygon", "polyline"].includes(tag);
  if (["font-size", "font-family"].includes(field.key)) return ["text", "tspan"].includes(tag);
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

function canDragNode(node) {
  if (!node || node === state.svgRoot) return false;
  const tag = node.tagName.toLowerCase();
  return !isNodeLocked(node) && !["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient", "stop"].includes(tag);
}

function getNumericAttr(node, attrName, fallback = 0) {
  const value = Number.parseFloat(node.getAttribute(attrName));
  return Number.isFinite(value) ? value : fallback;
}

function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}

function getGridMetrics() {
  const viewBox = getViewBoxRect();
  const rect = state.svgRoot?.getBoundingClientRect();
  const width = rect?.width || viewBox.width || GRID_SCREEN_SIZE;
  const height = rect?.height || viewBox.height || GRID_SCREEN_SIZE;

  return {
    originX: viewBox.x,
    originY: viewBox.y,
    stepX: (viewBox.width / width) * GRID_SCREEN_SIZE,
    stepY: (viewBox.height / height) * GRID_SCREEN_SIZE
  };
}

function snapCoordinate(value, step, origin) {
  if (!state.gridSnapEnabled || !Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }

  return origin + (Math.round((value - origin) / step) * step);
}

function snapNodeToGrid(node) {
  if (!state.gridSnapEnabled || !node) {
    return;
  }

  const grid = getGridMetrics();
  const tag = node.tagName.toLowerCase();

  if (["rect", "image", "foreignObject", "use", "text"].includes(tag)) {
    node.setAttribute("x", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "x"), grid.stepX, grid.originX))));
    node.setAttribute("y", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "y"), grid.stepY, grid.originY))));
    return;
  }

  if (["circle", "ellipse"].includes(tag)) {
    node.setAttribute("cx", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "cx"), grid.stepX, grid.originX))));
    node.setAttribute("cy", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "cy"), grid.stepY, grid.originY))));
    return;
  }

  if (tag === "line") {
    const nextX1 = snapCoordinate(getNumericAttr(node, "x1"), grid.stepX, grid.originX);
    const nextY1 = snapCoordinate(getNumericAttr(node, "y1"), grid.stepY, grid.originY);
    const dx = nextX1 - getNumericAttr(node, "x1");
    const dy = nextY1 - getNumericAttr(node, "y1");
    node.setAttribute("x1", String(roundCoordinate(nextX1)));
    node.setAttribute("y1", String(roundCoordinate(nextY1)));
    node.setAttribute("x2", String(roundCoordinate(getNumericAttr(node, "x2") + dx)));
    node.setAttribute("y2", String(roundCoordinate(getNumericAttr(node, "y2") + dy)));
  }
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
  const grid = getGridMetrics();

  if (descriptor.mode === "xy") {
    const nextX = snapCoordinate(descriptor.x + dx, grid.stepX, grid.originX);
    const nextY = snapCoordinate(descriptor.y + dy, grid.stepY, grid.originY);
    node.setAttribute("x", String(roundCoordinate(nextX)));
    node.setAttribute("y", String(roundCoordinate(nextY)));
    return;
  }

  if (descriptor.mode === "center") {
    const nextCx = snapCoordinate(descriptor.cx + dx, grid.stepX, grid.originX);
    const nextCy = snapCoordinate(descriptor.cy + dy, grid.stepY, grid.originY);
    node.setAttribute("cx", String(roundCoordinate(nextCx)));
    node.setAttribute("cy", String(roundCoordinate(nextCy)));
    return;
  }

  if (descriptor.mode === "line") {
    const nextX1 = snapCoordinate(descriptor.x1 + dx, grid.stepX, grid.originX);
    const nextY1 = snapCoordinate(descriptor.y1 + dy, grid.stepY, grid.originY);
    const snappedDx = nextX1 - descriptor.x1;
    const snappedDy = nextY1 - descriptor.y1;
    node.setAttribute("x1", String(roundCoordinate(nextX1)));
    node.setAttribute("y1", String(roundCoordinate(nextY1)));
    node.setAttribute("x2", String(roundCoordinate(descriptor.x2 + snappedDx)));
    node.setAttribute("y2", String(roundCoordinate(descriptor.y2 + snappedDy)));
    return;
  }

  const { a, b, c, d, e, f } = descriptor.baseMatrix;
  const nextE = roundCoordinate(snapCoordinate(e + dx, grid.stepX, 0));
  const nextF = roundCoordinate(snapCoordinate(f + dy, grid.stepY, 0));
  node.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${nextE} ${nextF})`);
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

function syncChrome() {
  ui.appShell.classList.toggle("is-topbar-collapsed", state.topbarCollapsed);
  ui.appShell.classList.toggle("is-left-hidden", state.leftPanelHidden);
  ui.appShell.classList.toggle("is-right-hidden", state.rightPanelHidden);

  ui.showTopbarButton.classList.toggle("hidden", !state.topbarCollapsed);
  ui.collapseTopbarButton.querySelector(".tool-label").textContent = state.topbarCollapsed ? "Show Bar" : "Hide Bar";
  ui.collapseTopbarButton.querySelector(".tool-icon").textContent = state.topbarCollapsed ? "▾" : "▴";
  ui.collapseTopbarButton.title = state.topbarCollapsed ? "Show toolbar" : "Hide toolbar";

  ui.floatingLeftButton.textContent = state.leftPanelHidden ? "Show Left" : "Hide Left";
  ui.floatingLeftButton.classList.toggle("is-active", !state.leftPanelHidden);
  ui.hideLeftPanelButton.textContent = state.leftPanelHidden ? "+" : "×";

  ui.floatingRightButton.textContent = state.rightPanelHidden ? "Show Right" : "Hide Right";
  ui.floatingRightButton.classList.toggle("is-active", !state.rightPanelHidden);
  ui.hideRightPanelButton.textContent = state.rightPanelHidden ? "+" : "×";
}

function syncChrome() {
  ui.appShell.classList.toggle("is-topbar-collapsed", state.topbarCollapsed);
  ui.appShell.classList.toggle("is-left-hidden", state.leftPanelHidden);
  ui.appShell.classList.toggle("is-right-hidden", state.rightPanelHidden);
  ui.workspaceSurface.classList.toggle("is-grid-snap", state.gridSnapEnabled);

  ui.showTopbarButton.classList.toggle("hidden", !state.topbarCollapsed);
  ui.collapseTopbarButton.querySelector(".tool-label").textContent = state.topbarCollapsed ? "Show" : "Hide";
  ui.collapseTopbarButton.querySelector(".tool-icon").textContent = state.topbarCollapsed ? "+" : "-";
  ui.collapseTopbarButton.title = state.topbarCollapsed ? "Show toolbar" : "Hide toolbar";
  ui.gridSnapButton.classList.toggle("is-active", state.gridSnapEnabled);
  ui.gridSnapButton.setAttribute("aria-pressed", String(state.gridSnapEnabled));
  ui.gridSnapButton.title = state.gridSnapEnabled ? "Disable grid snap" : "Enable grid snap";

  ui.floatingLeftButton.textContent = state.leftPanelHidden ? "Show Left" : "Hide Left";
  ui.floatingLeftButton.classList.toggle("is-active", !state.leftPanelHidden);
  ui.hideLeftPanelButton.textContent = state.leftPanelHidden ? "+" : "X";

  ui.floatingRightButton.textContent = state.rightPanelHidden ? "Show Right" : "Hide Right";
  ui.floatingRightButton.classList.toggle("is-active", !state.rightPanelHidden);
  ui.hideRightPanelButton.textContent = state.rightPanelHidden ? "+" : "X";
}

function setTopbarCollapsed(collapsed) {
  state.topbarCollapsed = collapsed;
  syncChrome();
}

function setLeftPanelHidden(hidden) {
  state.leftPanelHidden = hidden;
  syncChrome();
}

function setRightPanelHidden(hidden) {
  state.rightPanelHidden = hidden;
  syncChrome();
}

function setGridSnapEnabled(enabled) {
  state.gridSnapEnabled = enabled;
  try {
    localStorage.setItem(GRID_SNAP_STORAGE_KEY, String(enabled));
  } catch (error) {
    // Ignore storage errors and keep the toggle working for this session.
  }
  syncChrome();
}

function setSourcePaneVisible(visible) {
  state.sourceVisible = visible;
  ui.sourcePane.classList.toggle("hidden", !visible);
  ui.workspaceContent.classList.toggle("is-source-visible", visible);
  ui.sourceToggleButton.classList.remove("is-active");
  if (visible) {
    ui.sourceToggleButton.classList.add("is-active");
    updateSource();
    requestAnimationFrame(() => ui.sourceEditor.focus());
  }
  ui.sourceToggleButton.setAttribute("aria-expanded", String(visible));
  ui.sourceToggleButton.title = visible ? "Hide source" : "Show source";
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
  const canChange = Boolean(active && active !== state.svgRoot && !isNodeLocked(active));
  ui.undoButton.disabled = state.historyIndex <= 0;
  ui.redoButton.disabled = state.historyIndex >= state.history.length - 1 || state.historyIndex < 0;
  ui.duplicateButton.disabled = !canChange;
  ui.deleteButton.disabled = !canChange;
}

function getFieldValue(node, field) {
  return field.kind === "readonly"
    ? field.value(node)
    : field.kind === "text"
      ? (node.textContent ?? "")
      : (node.getAttribute(field.key) ?? "");
}

function getNodeParentLabel(node) {
  if (node === state.svgRoot) {
    return "Canvas";
  }
  const parent = node.parentElement;
  if (!parent || parent === node) {
    return "None";
  }
  return labelFor(parent);
}

function getInspectorNodeName(node) {
  if (node === state.svgRoot) {
    return "SVG Document";
  }
  return labelFor(node);
}

function getNodeStatusTokens(node) {
  const tokens = [`${node.tagName.toLowerCase()}`];
  tokens.push(isNodeHidden(node) ? "Hidden" : "Visible");
  if (isNodeLocked(node)) {
    tokens.push("Locked");
  }
  return tokens;
}

function getQuickFieldKeys(node) {
  const tag = node.tagName.toLowerCase();
  if (tag === "circle") return ["fill", "stroke", "stroke-width", "opacity", "cx", "cy", "r"];
  if (tag === "ellipse") return ["fill", "stroke", "stroke-width", "opacity", "cx", "cy", "rx", "ry"];
  if (tag === "line") return ["stroke", "stroke-width", "opacity", "x1", "y1", "x2", "y2"];
  if (tag === "text" || tag === "tspan") return ["textContent", "fill", "opacity", "x", "y", "font-size", "font-family"];
  if (tag === "path") return ["fill", "stroke", "stroke-width", "opacity", "d"];
  return ["fill", "stroke", "stroke-width", "opacity", "x", "y", "width", "height"];
}

function getInspectorSections(node) {
  const quick = getQuickFieldKeys(node).map((key) => FIELD_MAP.get(key)).filter((field) => field && visibleField(node, field));
  const used = new Set(quick.map((field) => field.key));
  const collect = (keys) => keys
    .map((key) => FIELD_MAP.get(key))
    .filter((field) => field && visibleField(node, field) && !used.has(field.key))
    .map((field) => {
      used.add(field.key);
      return field;
    });

  return [
    { title: "Quick Edit", open: true, fields: quick },
    { title: "Geometry", open: false, fields: collect(["x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry"]) },
    { title: "Appearance", open: false, fields: collect(["fill", "stroke", "stroke-width", "opacity", "font-size", "font-family"]) },
    { title: "Transform", open: false, fields: collect(["transform"]) },
    { title: "Content", open: quick.some((field) => ["textContent", "d", "points"].includes(field.key)), fields: collect(["textContent", "d", "points"]) },
    { title: "Metadata", open: false, fields: collect(["tagName", "id", "class"]) }
  ].filter((section) => section.fields.length);
}

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normalizeColorValue(value) {
  const trimmed = value.trim();
  if (isHexColor(trimmed)) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }

  const rgbMatch = trimmed.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgbMatch) {
    return null;
  }

  const values = rgbMatch.slice(1).map((part) => Math.max(0, Math.min(255, Number(part))));
  return `#${values.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function syncFontPreset(select, value) {
  const normalized = value.trim();
  const customOption = select.querySelector("option[data-font-custom='true']");
  if (customOption) {
    customOption.remove();
  }

  if (!normalized) {
    select.value = "";
    return;
  }

  const presetMatch = [...select.options].find((option) => option.value === normalized);
  if (presetMatch) {
    select.value = normalized;
    return;
  }

  const option = document.createElement("option");
  option.value = normalized;
  option.textContent = `Current (${normalized})`;
  option.dataset.fontCustom = "true";
  option.style.fontFamily = normalized;
  select.append(option);
  select.value = normalized;
}

function createInspectorField(node, field, locked) {
  const row = ui.fieldTemplate.content.firstElementChild.cloneNode(true);
  row.classList.add("inspector-field");
  const label = row.querySelector(".field-label");
  const originalInput = row.querySelector(".field-input");
  const value = getFieldValue(node, field);
  label.textContent = field.label;

  if (field.multiline) {
    const input = document.createElement("textarea");
    input.className = `${originalInput.className} inspector-textarea`;
    originalInput.replaceWith(input);
    input.value = value;
    if (field.kind === "readonly") input.readOnly = true;
    if (locked && field.kind !== "readonly") input.disabled = true;
    const commit = () => updateField(node.dataset.editorId, field, input.value, true);
    if (!locked && field.kind !== "readonly" && field.key !== "id") {
      input.addEventListener("input", () => updateField(node.dataset.editorId, field, input.value, false));
    }
    if (!locked && field.kind !== "readonly") {
      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);
    }
    return row;
  }

  if (COLOR_FIELDS.has(field.key) && field.kind === "attr") {
    row.classList.add("field-row-color");
    const wrapper = document.createElement("div");
    const colorInput = document.createElement("input");
    const textInput = document.createElement("input");
    wrapper.className = "field-combo";
    colorInput.type = "color";
    colorInput.className = "field-swatch";
    textInput.className = `${originalInput.className} field-input-text`;
    textInput.value = value;
    const normalized = normalizeColorValue(value);
    colorInput.value = normalized || "#000000";
    colorInput.disabled = locked;
    textInput.disabled = locked;
    if (!normalized) {
      colorInput.classList.add("is-unset");
    }
    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      colorInput.classList.remove("is-unset");
      updateField(node.dataset.editorId, field, colorInput.value, false);
    });
    colorInput.addEventListener("change", () => updateField(node.dataset.editorId, field, colorInput.value, true));
    textInput.addEventListener("input", () => {
      const nextNormalized = normalizeColorValue(textInput.value);
      if (nextNormalized) {
        colorInput.value = nextNormalized;
        colorInput.classList.remove("is-unset");
      } else {
        colorInput.classList.add("is-unset");
      }
      updateField(node.dataset.editorId, field, textInput.value, false);
    });
    textInput.addEventListener("change", () => updateField(node.dataset.editorId, field, textInput.value, true));
    textInput.addEventListener("blur", () => updateField(node.dataset.editorId, field, textInput.value, true));
    originalInput.replaceWith(wrapper);
    wrapper.append(colorInput, textInput);
    return row;
  }

  if (field.key === "font-family" && field.kind === "attr") {
    row.classList.add("field-row-font");
    const wrapper = document.createElement("div");
    const presetInput = document.createElement("select");
    const textInput = document.createElement("input");
    wrapper.className = "field-font";
    presetInput.className = "field-input field-font-select";
    textInput.className = `${originalInput.className} field-input-text`;
    textInput.value = value;
    textInput.placeholder = "Custom font-family stack";
    presetInput.disabled = locked;
    textInput.disabled = locked;

    COMMON_FONT_OPTIONS.forEach((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      option.style.fontFamily = optionConfig.value || "";
      presetInput.append(option);
    });
    syncFontPreset(presetInput, value);

    presetInput.addEventListener("change", () => {
      textInput.value = presetInput.value;
      syncFontPreset(presetInput, textInput.value);
      updateField(node.dataset.editorId, field, textInput.value, true);
    });
    textInput.addEventListener("input", () => {
      syncFontPreset(presetInput, textInput.value);
      updateField(node.dataset.editorId, field, textInput.value, false);
    });
    textInput.addEventListener("change", () => {
      syncFontPreset(presetInput, textInput.value);
      updateField(node.dataset.editorId, field, textInput.value, true);
    });
    textInput.addEventListener("blur", () => {
      syncFontPreset(presetInput, textInput.value);
      updateField(node.dataset.editorId, field, textInput.value, true);
    });

    originalInput.replaceWith(wrapper);
    wrapper.append(presetInput, textInput);
    return row;
  }

  if (field.key === "opacity" && field.kind === "attr") {
    row.classList.add("field-row-range");
    const wrapper = document.createElement("div");
    const rangeInput = document.createElement("input");
    const numberInput = document.createElement("input");
    wrapper.className = "field-range";
    rangeInput.type = "range";
    rangeInput.min = "0";
    rangeInput.max = "1";
    rangeInput.step = "0.01";
    rangeInput.value = value || "1";
    numberInput.type = "number";
    numberInput.min = "0";
    numberInput.max = "1";
    numberInput.step = "0.01";
    numberInput.className = `${originalInput.className} field-input-number`;
    numberInput.value = value || "1";
    rangeInput.disabled = locked;
    numberInput.disabled = locked;
    rangeInput.addEventListener("input", () => {
      numberInput.value = rangeInput.value;
      updateField(node.dataset.editorId, field, rangeInput.value, false);
    });
    rangeInput.addEventListener("change", () => updateField(node.dataset.editorId, field, rangeInput.value, true));
    numberInput.addEventListener("input", () => {
      rangeInput.value = numberInput.value || "0";
      updateField(node.dataset.editorId, field, numberInput.value, false);
    });
    numberInput.addEventListener("change", () => updateField(node.dataset.editorId, field, numberInput.value, true));
    numberInput.addEventListener("blur", () => updateField(node.dataset.editorId, field, numberInput.value, true));
    originalInput.replaceWith(wrapper);
    wrapper.append(rangeInput, numberInput);
    return row;
  }

  const input = originalInput;
  input.value = value;
  if (field.kind === "readonly") input.readOnly = true;
  if (NUMERIC_FIELDS.has(field.key) && field.kind !== "readonly") {
    input.type = "number";
    input.step = field.key === "opacity" ? "0.01" : "any";
  }
  if (locked && field.kind !== "readonly") input.disabled = true;
  const commit = () => updateField(node.dataset.editorId, field, input.value, true);
  if (!locked && field.kind !== "readonly" && field.key !== "id") {
    input.addEventListener("input", () => updateField(node.dataset.editorId, field, input.value, false));
  }
  if (!locked && field.kind !== "readonly") {
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
  }
  return row;
}

function renderTree() {
  ui.treePanel.innerHTML = "";
  if (!state.svgRoot) return;
  const fragment = document.createDocumentFragment();
  const walk = (node, depth) => {
    if (node.tagName.toLowerCase() === "style") return;
    const children = getRenderableChildren(node);
    const hasChildren = children.length > 0;
    const collapsed = state.collapsedNodes.has(node.dataset.editorId);
    const locked = isNodeLocked(node);
    const hidden = isNodeHidden(node);
    const row = document.createElement("div");
    const main = document.createElement("div");
    const expander = document.createElement("button");
    const selectButton = document.createElement("button");
    const dot = document.createElement("span");
    const tag = document.createElement("span");
    const label = document.createElement("span");
    row.className = "tree-item";
    if (node.dataset.editorId === state.selectedId) row.classList.add("is-selected");
    if (locked) row.classList.add("is-locked");
    if (hidden) row.classList.add("is-hidden");
    row.style.setProperty("--depth", depth);
    main.className = "tree-main";
    expander.type = "button";
    expander.className = "tree-expander";
    expander.textContent = hasChildren ? (collapsed ? "▸" : "▾") : "•";
    if (!hasChildren) {
      expander.classList.add("is-placeholder");
      expander.disabled = true;
    } else {
      expander.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleNodeCollapse(node.dataset.editorId);
      });
    }
    selectButton.type = "button";
    selectButton.className = "tree-select";
    dot.className = "tree-dot";
    tag.className = "tree-tag";
    label.className = "tree-label";
    tag.textContent = node.tagName.toLowerCase();
    label.textContent = labelFor(node);
    selectButton.append(dot, tag, label);
    selectButton.addEventListener("click", () => selectNode(node.dataset.editorId));
    main.append(expander, selectButton);

    const actions = document.createElement("div");
    const visibilityButton = document.createElement("button");
    const lockButton = document.createElement("button");
    actions.className = "tree-actions";
    visibilityButton.type = "button";
    visibilityButton.className = `tree-action${!hidden ? " is-active" : ""}`;
    visibilityButton.textContent = hidden ? "Show" : "Hide";
    visibilityButton.title = hidden ? "Show layer" : "Hide layer";
    visibilityButton.disabled = node === state.svgRoot;
    visibilityButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleNodeVisibility(node.dataset.editorId);
    });
    lockButton.type = "button";
    lockButton.className = `tree-action${locked ? " is-active" : ""}`;
    lockButton.textContent = locked ? "Unlock" : "Lock";
    lockButton.title = locked ? "Unlock layer" : "Lock layer";
    lockButton.disabled = node === state.svgRoot;
    lockButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleNodeLock(node.dataset.editorId);
    });
    actions.append(visibilityButton, lockButton);

    row.append(main, actions);
    fragment.append(row);
    if (!collapsed) {
      children.forEach((child) => walk(child, depth + 1));
    }
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
  const locked = isNodeLocked(node);
  const hidden = isNodeHidden(node);

  const objectCard = document.createElement("section");
  const objectTop = document.createElement("div");
  const objectMeta = document.createElement("div");
  const objectActions = document.createElement("div");
  const typeChip = document.createElement("span");
  const name = document.createElement("strong");
  const parentMeta = document.createElement("span");
  const statusMeta = document.createElement("span");
  const visibilityButton = document.createElement("button");
  const lockButton = document.createElement("button");

  objectCard.className = "inspector-card inspector-object-card";
  objectTop.className = "inspector-object-top";
  objectMeta.className = "inspector-object-meta";
  objectActions.className = "inspector-action-row";
  typeChip.className = "inspector-type-chip";
  name.className = "inspector-object-name";
  typeChip.textContent = node.tagName.toLowerCase();
  name.textContent = getInspectorNodeName(node);
  parentMeta.textContent = `Parent: ${getNodeParentLabel(node)}`;
  statusMeta.textContent = getNodeStatusTokens(node).join(" · ");

  visibilityButton.type = "button";
  visibilityButton.className = "inspector-action-button";
  visibilityButton.textContent = hidden ? "Show" : "Hide";
  visibilityButton.disabled = node === state.svgRoot;
  visibilityButton.addEventListener("click", () => toggleNodeVisibility(node.dataset.editorId));

  lockButton.type = "button";
  lockButton.className = "inspector-action-button";
  lockButton.textContent = locked ? "Unlock" : "Lock";
  lockButton.disabled = node === state.svgRoot;
  lockButton.addEventListener("click", () => toggleNodeLock(node.dataset.editorId));

  objectTop.append(typeChip, name);
  objectMeta.append(parentMeta, statusMeta);
  objectActions.append(visibilityButton, lockButton);
  objectCard.append(objectTop, objectMeta, objectActions);
  ui.propertyForm.append(objectCard);

  if (locked) {
    const note = document.createElement("p");
    note.className = "inspector-note";
    note.textContent = "This layer is locked. Unlock it to edit attributes.";
    ui.propertyForm.append(note);
  }

  getInspectorSections(node).forEach((section) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const content = document.createElement("div");
    details.className = "inspector-card inspector-section";
    if (section.open) details.open = true;
    summary.className = "inspector-section-summary";
    summary.textContent = section.title;
    content.className = "inspector-section-body";
    if (section.title === "Quick Edit") {
      content.classList.add("inspector-quick-grid");
    }
    section.fields.forEach((field) => content.append(createInspectorField(node, field, locked)));
    details.append(summary, content);
    ui.propertyForm.append(details);
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

function toggleNodeCollapse(editorId) {
  if (state.collapsedNodes.has(editorId)) {
    state.collapsedNodes.delete(editorId);
  } else {
    state.collapsedNodes.add(editorId);
  }
  renderTree();
}

function toggleNodeVisibility(editorId) {
  const node = state.nodeMap.get(editorId);
  if (!node || node === state.svgRoot) return;
  if (isNodeHidden(node)) {
    const backup = node.dataset.editorDisplayBackup;
    if (backup) {
      node.setAttribute("display", backup);
      delete node.dataset.editorDisplayBackup;
    } else {
      node.removeAttribute("display");
    }
  } else {
    const current = node.getAttribute("display");
    if (current && current !== "none") {
      node.dataset.editorDisplayBackup = current;
    } else {
      delete node.dataset.editorDisplayBackup;
    }
    node.setAttribute("display", "none");
  }
  updateSource();
  renderWorkspace();
  renderTree();
  recordHistory("visibility");
}

function toggleNodeLock(editorId) {
  const node = state.nodeMap.get(editorId);
  if (!node || node === state.svgRoot) return;
  node.dataset.editorLocked = isNodeLocked(node) ? "false" : "true";
  renderTree();
  renderInspector();
  renderOverlay();
  updateActions();
  updateSource();
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
  applyZoom();
  renderOverlay();
}

function updateField(editorId, field, value, record) {
  const node = state.nodeMap.get(editorId);
  if (!node || field.kind === "readonly") return;
  if (isNodeLocked(node)) return;
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
  if (!node || node === state.svgRoot || !node.parentNode || isNodeLocked(node)) return;
  const clone = node.cloneNode(true);
  remapSubtreeIds(clone);
  addEditorIds(clone);
  node.parentNode.insertBefore(clone, node.nextSibling);
  rebuildNodeMap();
  renderTree();
  updateSource();
  selectNode(clone.dataset.editorId);
  recordHistory("duplicate");
}

function deleteSelection() {
  const node = state.nodeMap.get(state.selectedId);
  if (!node || node === state.svgRoot || !node.parentNode || isNodeLocked(node)) return;
  const fallback = node.previousElementSibling || node.parentElement || state.svgRoot;
  node.remove();
  rebuildNodeMap();
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
  state.collapsedNodes.clear();
  rebuildNodeMap();
  renderWorkspace();
  renderTree();
  updateSource();
  selectNode(root.dataset.editorId);
  if (pushHistory) recordHistory("load");
  else updateActions();
}

ui.importButton.addEventListener("click", () => ui.fileInput.click());
ui.gridSnapButton.addEventListener("click", () => setGridSnapEnabled(!state.gridSnapEnabled));
ui.sourceToggleButton.addEventListener("click", () => {
  setSourcePaneVisible(!state.sourceVisible);
});
ui.collapseTopbarButton.addEventListener("click", () => setTopbarCollapsed(!state.topbarCollapsed));
ui.showTopbarButton.addEventListener("click", () => setTopbarCollapsed(false));
ui.hideLeftPanelButton.addEventListener("click", () => setLeftPanelHidden(true));
ui.hideRightPanelButton.addEventListener("click", () => setRightPanelHidden(true));
ui.floatingLeftButton.addEventListener("click", () => setLeftPanelHidden(!state.leftPanelHidden));
ui.floatingRightButton.addEventListener("click", () => setRightPanelHidden(!state.rightPanelHidden));
ui.insertImageButton.addEventListener("click", () => ui.imageInput.click());
ui.newDocumentButton.addEventListener("click", () => loadDocument(EMPTY_SVG));
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
  if (event.key === "Escape" && state.sourceVisible) {
    setSourcePaneVisible(false);
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

syncChrome();
setSourcePaneVisible(false);
loadDocument(SAMPLE_SVG);
