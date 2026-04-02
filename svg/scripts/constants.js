export const SAMPLE_SVG = `
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

export const EMPTY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <rect id="canvasBackground" x="0" y="0" width="1200" height="800" fill="#fffdf8" />
</svg>
`.trim();

export const FIELDS = [
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

export const FIELD_MAP = new Map(FIELDS.flatMap(([, fields]) => fields.map((field) => [field.key, field])));
export const NUMERIC_FIELDS = new Set(["opacity", "stroke-width", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "font-size"]);
export const COLOR_FIELDS = new Set(["fill", "stroke"]);
export const GRID_SCREEN_SIZE = 28;
export const GRID_SNAP_STORAGE_KEY = "svgStudio.gridSnap";
export const COMMON_FONT_OPTIONS = [
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

export const DANGEROUS_TAGS = new Set(["script", "foreignobject", "iframe", "object", "embed"]);
export const REFERENCE_ATTRS = new Set([
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
