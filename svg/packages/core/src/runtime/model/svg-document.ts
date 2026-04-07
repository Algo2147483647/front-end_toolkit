import {
  DANGEROUS_TAGS,
  REFERENCE_ATTRS
} from "../constants";
import type {
  DocumentTools,
  EditorSvgElement,
  SerializedSvgChild,
  SerializedSvgElementNode,
  SvgRuntimeStateLike,
  SvgSvgNode
} from "./types";

function getSvgSubtree(root: Element): Element[] {
  return [root, ...Array.from(root.querySelectorAll("*"))];
}

function isSvgRootElement(node: Element | null): node is SvgSvgNode {
  return Boolean(node instanceof SVGSVGElement);
}

function stabilizeSvgRootViewBox(root: Element | null) {
  const svgRoot = root as (Element & {
    getBBox?: () => { x: number; y: number; width: number; height: number };
    setAttribute?: (name: string, value: string) => void;
    hasAttribute?: (name: string) => boolean;
    getAttribute?: (name: string) => string | null;
    tagName?: string;
  }) | null;

  if (!svgRoot || String(svgRoot.tagName || "").toLowerCase() !== "svg") {
    return;
  }

  if (svgRoot.hasAttribute?.("viewBox")) {
    return;
  }

  const widthAttr = svgRoot.getAttribute?.("width");
  const heightAttr = svgRoot.getAttribute?.("height");
  if ((widthAttr && widthAttr.trim()) || (heightAttr && heightAttr.trim())) {
    return;
  }

  let bounds: { x: number; y: number; width: number; height: number } | null = null;
  try {
    const measured = svgRoot.getBBox?.();
    if (
      measured
      && Number.isFinite(measured.x)
      && Number.isFinite(measured.y)
      && Number.isFinite(measured.width)
      && Number.isFinite(measured.height)
      && measured.width > 0
      && measured.height > 0
    ) {
      bounds = measured;
    }
  } catch {
    bounds = null;
  }

  if (!bounds) {
    return;
  }

  svgRoot.setAttribute?.("viewBox", `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
}

export function createSvgDocumentTools(state: SvgRuntimeStateLike): DocumentTools {
  function serializeChildNode(node: ChildNode): SerializedSvgChild | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return {
        kind: "text",
        value: node.textContent || ""
      };
    }

    if (node instanceof SVGElement) {
      return serializeElementNode(node);
    }

    return null;
  }

  function serializeElementNode(node: Element): SerializedSvgElementNode {
    const attributes: Record<string, string> = {};
    node.getAttributeNames().forEach((name) => {
      const value = node.getAttribute(name);
      if (value != null) {
        attributes[name] = value;
      }
    });

    return {
      kind: "element",
      tagName: node.tagName,
      attributes,
      children: Array.from(node.childNodes)
        .map((child) => serializeChildNode(child))
        .filter(Boolean) as SerializedSvgChild[]
    };
  }

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function sanitizeDomId(value: string | null | undefined, fallback = "node") {
    const normalized = (value || fallback)
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9_.:-]/g, "-")
      .replace(/^-+/, "");

    return normalized || fallback;
  }

  function getUsedDomIds(excludeNode: Element | null = null) {
    const used = new Set<string>();
    if (!state.svgRoot) {
      return used;
    }

    for (const node of Array.from(state.svgRoot.querySelectorAll("[id]"))) {
      if (excludeNode && node === excludeNode) {
        continue;
      }

      const id = node.getAttribute("id");
      if (id) {
        used.add(id);
      }
    }

    if (state.svgRoot.hasAttribute("id") && state.svgRoot !== excludeNode) {
      const rootId = state.svgRoot.getAttribute("id");
      if (rootId) {
        used.add(rootId);
      }
    }

    return used;
  }

  function makeUniqueDomId(base: string | null | undefined, usedIds: Set<string>) {
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

  function replaceIdReferencesInValue(value: string, idMap: Map<string, string>) {
    let nextValue = value;

    for (const [oldId, newId] of idMap.entries()) {
      const escaped = escapeRegExp(oldId);
      nextValue = nextValue.replace(new RegExp(`url\\((['"]?)#${escaped}\\1\\)`, "g"), `url(#${newId})`);
      nextValue = nextValue.replace(new RegExp(`^#${escaped}$`, "g"), `#${newId}`);
      nextValue = nextValue.replace(new RegExp(`([;\\s(,])#${escaped}(?=\\b|[;\\s),])`, "g"), `$1#${newId}`);
    }

    return nextValue;
  }

  function rewriteNodeReferences(node: Element, idMap: Map<string, string>) {
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

  function rewriteDocumentReferences(idMap: Map<string, string>) {
    if (!state.svgRoot || !idMap.size) {
      return;
    }

    for (const node of getSvgSubtree(state.svgRoot)) {
      rewriteNodeReferences(node, idMap);
    }
  }

  function remapSubtreeIds(root: Element) {
    const usedIds = getUsedDomIds();
    const idMap = new Map<string, string>();

    for (const node of getSvgSubtree(root)) {
      const oldId = node.getAttribute("id");
      if (!oldId) {
        continue;
      }

      const nextId = makeUniqueDomId(oldId, usedIds);
      idMap.set(oldId, nextId);
      node.setAttribute("id", nextId);
    }

    for (const node of getSvgSubtree(root)) {
      rewriteNodeReferences(node, idMap);
    }
  }

  function renameNodeId(node: Element, requestedId?: string) {
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

  function isSafeHref(value: string) {
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith("#") || normalized.startsWith("data:");
  }

  function sanitizeCssText(value: string) {
    if (/@import/i.test(value) || /javascript:/i.test(value) || /expression\s*\(/i.test(value)) {
      return "";
    }

    return value.replace(/url\((.*?)\)/gi, (_match, inner: string) => {
      const normalized = inner.trim().replace(/^['"]|['"]$/g, "");
      return normalized.startsWith("#") ? `url(#${normalized.slice(1)})` : "";
    });
  }

  function sanitizeSvgTree(root: SvgSvgNode) {
    const warnings: string[] = [];

    for (const node of getSvgSubtree(root)) {
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

  function parseSvg(source: string): SvgSvgNode {
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const error = parsed.querySelector("parsererror");
    if (error) {
      throw new Error(error.textContent?.trim() || "Failed to parse SVG");
    }

    const root = parsed.documentElement;
    if (!isSvgRootElement(root) || root.tagName.toLowerCase() !== "svg") {
      throw new Error("Imported content is not valid SVG");
    }

    state.warnings = sanitizeSvgTree(root);
    return root;
  }

  function captureDocumentSnapshot(root: Element | null = state.svgRoot) {
    if (!root) {
      return null;
    }

    stabilizeSvgRootViewBox(root);
    return serializeElementNode(root);
  }

  function cleanForExport(root: Element) {
    for (const node of getSvgSubtree(root)) {
      for (const attrName of node.getAttributeNames()) {
        if (attrName.startsWith("data-editor-")) {
          node.removeAttribute(attrName);
        }
      }
    }
  }

  function serialize() {
    if (!state.svgRoot) {
      return "";
    }

    const clone = state.svgRoot.cloneNode(true) as EditorSvgElement;
    cleanForExport(clone);
    return new XMLSerializer().serializeToString(clone);
  }

  return {
    captureDocumentSnapshot,
    parseSvg,
    remapSubtreeIds,
    renameNodeId,
    serialize
  };
}
