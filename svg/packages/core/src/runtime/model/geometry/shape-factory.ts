import type {
  EditorSvgElement,
  MetadataTools,
  ShapeFactoryTools,
  SvgRuntimeStateLike,
  ViewportTools
} from "../types";

interface ShapeFactoryDeps {
  state: SvgRuntimeStateLike;
  getViewBoxRect: ViewportTools["getViewBoxRect"];
  isNodeLocked: MetadataTools["isNodeLocked"];
}

function createSvgElement<T extends keyof SVGElementTagNameMap>(tagName: T) {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName) as SVGElementTagNameMap[T] & EditorSvgElement;
}

export function createSvgShapeFactoryTools({ state, getViewBoxRect, isNodeLocked }: ShapeFactoryDeps): ShapeFactoryTools {
  function nextNodeName(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function getInsertParent() {
    const root = state.svgRoot;
    const selected = state.selectedId ? state.nodeMap.get(state.selectedId) : null;
    if (!root || !selected || selected === root) {
      return root;
    }

    if (isNodeLocked(selected)) {
      return (selected.parentElement as EditorSvgElement | null) || root;
    }

    const tag = selected.tagName.toLowerCase();
    if (["g", "svg"].includes(tag)) {
      return selected;
    }

    if (["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient"].includes(tag)) {
      return root;
    }

    return (selected.parentElement as EditorSvgElement | null) || root;
  }

  function createElementNode(kind: string): EditorSvgElement {
    const box = getViewBoxRect();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const node = createSvgElement(kind as keyof SVGElementTagNameMap);

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

    if (kind === "polyline") {
      node.setAttribute("id", nextNodeName("polyline"));
      node.setAttribute(
        "points",
        [
          `${centerX - 140},${centerY + 36}`,
          `${centerX - 52},${centerY - 42}`,
          `${centerX + 10},${centerY + 8}`,
          `${centerX + 132},${centerY - 78}`
        ].join(" ")
      );
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "#0f766e");
      node.setAttribute("stroke-width", "12");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
    }

    if (kind === "polygon") {
      node.setAttribute("id", nextNodeName("polygon"));
      node.setAttribute(
        "points",
        [
          `${centerX},${centerY - 96}`,
          `${centerX + 112},${centerY - 18}`,
          `${centerX + 70},${centerY + 98}`,
          `${centerX - 70},${centerY + 98}`,
          `${centerX - 112},${centerY - 18}`
        ].join(" ")
      );
      node.setAttribute("fill", "#2563eb");
      node.setAttribute("stroke", "#173f94");
      node.setAttribute("stroke-width", "8");
      node.setAttribute("stroke-linejoin", "round");
      node.setAttribute("opacity", "0.9");
    }

    if (kind === "path") {
      node.setAttribute("id", nextNodeName("path"));
      node.setAttribute(
        "d",
        `M ${centerX - 148} ${centerY + 40} C ${centerX - 82} ${centerY - 102}, ${centerX + 82} ${centerY - 102}, ${centerX + 148} ${centerY + 40}`
      );
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "#b5461d");
      node.setAttribute("stroke-width", "12");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
    }

    return node;
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
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

  async function createImageNodeFromFile(file: File) {
    const box = getViewBoxRect();
    const dataUrl = await readFileAsDataUrl(file);
    const size = await measureImage(dataUrl);
    const maxWidth = Math.max(180, box.width * 0.38);
    const scale = Math.min(1, maxWidth / size.width);
    const width = Math.round(size.width * scale);
    const height = Math.round(size.height * scale);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const imageNode = createSvgElement("image");

    imageNode.setAttribute("id", nextNodeName("image"));
    imageNode.setAttribute("x", String(centerX - width / 2));
    imageNode.setAttribute("y", String(centerY - height / 2));
    imageNode.setAttribute("width", String(width));
    imageNode.setAttribute("height", String(height));
    imageNode.setAttribute("preserveAspectRatio", "xMidYMid meet");
    imageNode.setAttribute("href", dataUrl);

    return imageNode;
  }

  return {
    createElementNode,
    createImageNodeFromFile,
    getInsertParent
  };
}
