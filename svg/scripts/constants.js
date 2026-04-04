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
    { key: "typography-controls", label: "Text style", kind: "typography-controls" },
    { key: "fill", label: "fill", kind: "attr" },
    { key: "stroke", label: "stroke", kind: "attr" },
    { key: "stroke-width", label: "stroke-width", kind: "attr" },
    { key: "font-size", label: "font-size", kind: "attr" },
    { key: "font-family", label: "font-family", kind: "attr" },
    { key: "font-weight", label: "font-weight", kind: "attr", options: "font-weight" },
    { key: "font-style", label: "font-style", kind: "attr", options: "font-style" },
    { key: "text-decoration", label: "text-decoration", kind: "attr", options: "text-decoration" },
    { key: "letter-spacing", label: "letter-spacing", kind: "attr" },
    { key: "text-anchor", label: "text-anchor", kind: "attr", options: "text-anchor" }
  ]],
  ["Geometry", [
    { key: "z-order", label: "z priority", kind: "z-order" },
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
    { key: "ry", label: "ry", kind: "attr" },
    { key: "polygon-sides", label: "polygon sides", kind: "polygon-sides" },
    { key: "polygon-regularize", label: "regular polygon", kind: "polygon-regularize" },
    { key: "polyline-points", label: "polyline points", kind: "polyline-points" },
    { key: "path-bezier", label: "Bezier curve", kind: "path-bezier" }
  ]],
  ["Advanced", [
    { key: "d", label: "path d", kind: "attr", multiline: true },
    { key: "points", label: "points", kind: "attr", multiline: true },
    { key: "textContent", label: "text content", kind: "text", multiline: true }
  ]]
];

export const FIELD_MAP = new Map(FIELDS.flatMap(([, fields]) => fields.map((field) => [field.key, field])));
export const NUMERIC_FIELDS = new Set(["z-order", "opacity", "stroke-width", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "font-size", "letter-spacing"]);
export const COLOR_FIELDS = new Set(["fill", "stroke"]);
export const GRID_SCREEN_SIZE = 28;
export const GRID_SNAP_SIZE_OPTIONS = [1, 2, 3, 4, 5, 7, 10, 12, 15, 16, 20, 24, 28, 40, 56];
export const GRID_SNAP_STORAGE_KEY = "svgStudio.gridSnap";
export const GRID_SNAP_SIZE_STORAGE_KEY = "svgStudio.gridSnapSize";
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

export const COMMON_FONT_SIZE_OPTIONS = [
  { label: "Document default", value: "" },
  { label: "10 px", value: "10" },
  { label: "12 px", value: "12" },
  { label: "14 px", value: "14" },
  { label: "16 px", value: "16" },
  { label: "18 px", value: "18" },
  { label: "20 px", value: "20" },
  { label: "24 px", value: "24" },
  { label: "28 px", value: "28" },
  { label: "32 px", value: "32" },
  { label: "36 px", value: "36" },
  { label: "42 px", value: "42" },
  { label: "48 px", value: "48" },
  { label: "56 px", value: "56" },
  { label: "64 px", value: "64" },
  { label: "72 px", value: "72" }
];

export const COMMON_FONT_WEIGHT_OPTIONS = [
  { label: "Document default", value: "" },
  { label: "Normal 400", value: "400" },
  { label: "Medium 500", value: "500" },
  { label: "Semibold 600", value: "600" },
  { label: "Bold 700", value: "700" },
  { label: "Black 900", value: "900" }
];

export const FONT_STYLE_OPTIONS = [
  { label: "Document default", value: "" },
  { label: "Normal", value: "normal" },
  { label: "Italic", value: "italic" },
  { label: "Oblique", value: "oblique" }
];

export const TEXT_DECORATION_OPTIONS = [
  { label: "Document default", value: "" },
  { label: "None", value: "none" },
  { label: "Underline", value: "underline" },
  { label: "Overline", value: "overline" },
  { label: "Line-through", value: "line-through" }
];

export const TEXT_ANCHOR_OPTIONS = [
  { label: "Document default", value: "" },
  { label: "Start", value: "start" },
  { label: "Middle", value: "middle" },
  { label: "End", value: "end" }
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
