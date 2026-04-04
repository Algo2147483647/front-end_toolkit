import {
  DANGEROUS_TAGS,
  REFERENCE_ATTRS
} from "../constants.js";

export function createSvgDocumentTools(state) {
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
    if (!state.svgRoot) {
      return "";
    }

    const clone = state.svgRoot.cloneNode(true);
    cleanForExport(clone);
    return new XMLSerializer().serializeToString(clone);
  }

  return {
    parseSvg,
    remapSubtreeIds,
    renameNodeId,
    serialize
  };
}
