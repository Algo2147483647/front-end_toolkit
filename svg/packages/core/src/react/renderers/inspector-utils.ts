import {
  COLOR_FIELDS,
  COMMON_FONT_OPTIONS,
  COMMON_FONT_SIZE_OPTIONS,
  COMMON_FONT_WEIGHT_OPTIONS,
  FIELD_MAP,
  FONT_STYLE_OPTIONS,
  TEXT_ANCHOR_OPTIONS,
  TEXT_DECORATION_OPTIONS
} from "../../../../../scripts/constants.js";

const FIELD_OPTION_SETS = new Map([
  ["font-weight", COMMON_FONT_WEIGHT_OPTIONS],
  ["font-style", FONT_STYLE_OPTIONS],
  ["text-decoration", TEXT_DECORATION_OPTIONS],
  ["text-anchor", TEXT_ANCHOR_OPTIONS]
]);

export {
  COLOR_FIELDS,
  COMMON_FONT_OPTIONS,
  COMMON_FONT_SIZE_OPTIONS,
  COMMON_FONT_WEIGHT_OPTIONS,
  FIELD_MAP
};

export function getSectionStateKey(node: Element, sectionTitle: string) {
  if (!node || !sectionTitle) {
    return null;
  }

  const nodeTag = node.tagName?.toLowerCase?.() || "node";
  return `${nodeTag}:${sectionTitle}`;
}

export function isSectionOpen(state: any, node: Element, section: any) {
  const key = getSectionStateKey(node, section.title);
  if (!key) {
    return Boolean(section.open);
  }

  if (state.inspectorSectionStates.has(key)) {
    return state.inspectorSectionStates.get(key);
  }

  return Boolean(section.open);
}

export function rememberSectionState(store: any, state: any, node: Element, sectionTitle: string, open: boolean) {
  const key = getSectionStateKey(node, sectionTitle);
  if (key) {
    if (store?.inspector?.setSectionState) {
      store.inspector.setSectionState(key, open);
      return;
    }

    state.inspectorSectionStates.set(key, Boolean(open));
  }
}

export function getFieldValue(model: any, node: Element, field: any) {
  if (["width", "height"].includes(field.key) && node.tagName.toLowerCase() === "text") {
    return model.getTextBoxDimension(node, field.key);
  }

  return field.kind === "readonly"
    ? field.value(node)
    : field.kind === "z-order"
      ? model.getZOrder(node)
      : field.kind === "text"
        ? (node.textContent ?? "")
        : (node.getAttribute(field.key) ?? "");
}

export function getNodeParentLabel(state: any, model: any, node: Element) {
  if (node === state.svgRoot) {
    return "Canvas";
  }

  const parent = node.parentElement;
  if (!parent || parent === node) {
    return "None";
  }

  return model.labelFor(parent);
}

export function getInspectorNodeName(state: any, model: any, node: Element) {
  if (node === state.svgRoot) {
    return "SVG Document";
  }

  return model.labelFor(node);
}

export function getNodeStatusTokens(model: any, node: Element) {
  const tokens = [node.tagName.toLowerCase()];
  tokens.push(model.isNodeHidden(node) ? "Hidden" : "Visible");
  if (model.isNodeLocked(node)) {
    tokens.push("Locked");
  }
  return tokens;
}

export function getQuickFieldKeys(node: Element) {
  const tag = node.tagName.toLowerCase();
  if (tag === "circle") return ["fill", "stroke", "stroke-width", "opacity", "cx", "cy", "r"];
  if (tag === "ellipse") return ["fill", "stroke", "stroke-width", "opacity", "cx", "cy", "rx", "ry"];
  if (tag === "line") return ["stroke", "stroke-width", "opacity", "x1", "y1", "x2", "y2"];
  if (tag === "text" || tag === "tspan") return ["typography-controls", "textContent", "fill", "opacity", "width", "height"];
  if (tag === "polyline") return ["polyline-points", "stroke", "stroke-width", "opacity", "points"];
  if (tag === "polygon") return ["polygon-sides", "polygon-regularize", "fill", "stroke", "stroke-width", "opacity", "points"];
  if (tag === "path") return ["path-bezier", "fill", "stroke", "stroke-width", "opacity", "d"];
  return ["fill", "stroke", "stroke-width", "opacity", "x", "y", "width", "height"];
}

export function getInspectorSections(model: any, node: Element) {
  const quick = getQuickFieldKeys(node)
    .map((key) => FIELD_MAP.get(key))
    .filter((field) => field && model.visibleField(node, field));
  const used = new Set(quick.map((field: any) => field.key));
  const collect = (keys: string[]) => keys
    .map((key) => FIELD_MAP.get(key))
    .filter((field) => field && model.visibleField(node, field) && !used.has(field.key))
    .map((field) => {
      used.add(field.key);
      return field;
    });

  return [
    { title: "Quick Edit", open: true, fields: quick },
    { title: "Geometry", open: false, fields: collect(["z-order", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry"]) },
    { title: "Typography", open: false, fields: collect(["font-family", "font-size", "font-weight", "font-style", "text-decoration", "letter-spacing", "text-anchor"]) },
    { title: "Appearance", open: false, fields: collect(["fill", "stroke", "stroke-width", "opacity"]) },
    { title: "Transform", open: false, fields: collect(["transform"]) },
    { title: "Content", open: quick.some((field: any) => ["textContent", "d", "points"].includes(field.key)), fields: collect(["textContent", "d", "points"]) },
    { title: "Metadata", open: false, fields: collect(["tagName", "id", "class"]) }
  ].filter((section) => section.fields.length);
}

export function getOptionSet(field: any) {
  if (typeof field.options === "string") {
    return FIELD_OPTION_SETS.get(field.options) || [];
  }

  return Array.isArray(field.options) ? field.options : null;
}

export function isHexColor(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeColorValue(value: string) {
  const trimmed = String(value || "").trim();
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

export function normalizeFontSizeValue(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:px)?$/i);
  if (!match) {
    return trimmed;
  }

  const numeric = Number.parseFloat(match[1]);
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  return `${numeric}`;
}

export function getResolvedComputedStyle(node: Element) {
  try {
    return globalThis.getComputedStyle?.(node) || null;
  } catch {
    return null;
  }
}

export function getResolvedTextStyle(node: Element, attrName: string) {
  const attrValue = node.getAttribute(attrName)?.trim();
  if (attrValue) {
    return attrValue;
  }

  const computed = getResolvedComputedStyle(node);
  if (!computed) {
    return "";
  }

  if (attrName === "font-weight") return computed.fontWeight || "";
  if (attrName === "font-style") return computed.fontStyle || "";
  if (attrName === "text-decoration") return computed.textDecorationLine || computed.textDecoration || "";
  if (attrName === "font-size") return computed.fontSize || "";
  if (attrName === "font-family") return computed.fontFamily || "";

  return "";
}

export function isTransparentColorValue(value: string) {
  return String(value || "").trim().toLowerCase() === "transparent";
}

export function isBoldStyleValue(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === "bold" || normalized === "bolder") {
    return true;
  }

  const numeric = Number.parseInt(normalized, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

export function isItalicStyleValue(value: string) {
  return /(italic|oblique)/i.test(String(value || "").trim());
}

export function getTextDecorationTokens(value: string) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => ["underline", "overline", "line-through"].includes(token))
  );
}

export function getQuickFieldVariant(field: any) {
  if (["typography-controls", "textContent", "d", "points", "font-family", "polygon-sides", "polygon-regularize", "polyline-points", "path-bezier"].includes(field.key) || field.multiline) {
    return "full";
  }

  if (["fill", "stroke", "stroke-width", "opacity"].includes(field.key)) {
    return "compact";
  }

  return "default";
}
