const GRAPH_STATE = {
    rawData: null,
    normalizedDag: null,
    currentRoot: null,
    history: [],
};

const GRAPH_THEME = {
    stagePaddingX: 96,
    stagePaddingY: 72,
    columnGap: 104,
    rowGap: 26,
    nodeHeight: 82,
    minNodeWidth: 170,
    maxNodeWidth: 280,
};

window.LoadDagData = function LoadDagData(input) {
    GRAPH_STATE.rawData = input;
    GRAPH_STATE.normalizedDag = NormalizeDagInput(input);
    GRAPH_STATE.history = [];

    const initialRoot = ResolveRootKey(GRAPH_STATE.normalizedDag);
    RenderSvgFromDag(initialRoot, false);
};

window.NavigateBack = function NavigateBack() {
    const previousRoot = GRAPH_STATE.history.pop();
    if (!previousRoot) {
        return;
    }

    RenderSvgFromDag(previousRoot, false);
};

window.SetGraphMessage = function SetGraphMessage(message) {
    const summary = document.getElementById("graph-summary");
    if (summary) {
        summary.textContent = message;
    }
};

window.ExportSvg = function ExportSvg(svg) {
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dag-graph.svg";
    a.click();
    URL.revokeObjectURL(url);
};

function RenderSvgFromDag(rootKey, pushHistory = true) {
    if (!GRAPH_STATE.normalizedDag) {
        return;
    }

    if (pushHistory && GRAPH_STATE.currentRoot && GRAPH_STATE.currentRoot !== rootKey) {
        GRAPH_STATE.history.push(GRAPH_STATE.currentRoot);
    }

    const { dag, root, reachable } = PrepareDagForRender(GRAPH_STATE.normalizedDag, rootKey);
    GRAPH_STATE.currentRoot = root;

    const stageData = BuildStageData(dag, reachable, root);
    MountGraph(stageData);
    UpdateChrome(stageData);
}

function NormalizeDagInput(input) {
    if (Array.isArray(input)) {
        const dag = {};

        input.forEach(item => {
            if (!item || !item.key) {
                return;
            }

            dag[item.key] = {
                ...item,
                kids: item.kids || [],
            };
        });

        return dag;
    }

    if (input && Array.isArray(input.nodes)) {
        return NormalizeDagInput(input.nodes);
    }

    if (input && typeof input === "object") {
        const dag = {};

        Object.entries(input).forEach(([key, value]) => {
            dag[key] = {
                ...(value || {}),
                kids: value && value.kids ? value.kids : [],
            };
        });

        return dag;
    }

    return {};
}

function ResolveRootKey(dag) {
    const roots = FindRootsFromDag(dag);

    if (roots.length === 1) {
        return roots[0];
    }

    if (dag.root) {
        return "root";
    }

    return "__graph_root__";
}

function PrepareDagForRender(sourceDag, requestedRoot) {
    const dag = StructuredClone(sourceDag);
    EnsureReferencedNodesExist(dag);

    const roots = FindRootsFromDag(dag);
    let root = requestedRoot;

    if (!dag[root]) {
        if (roots.length === 1) {
            root = roots[0];
        } else if (dag.root) {
            root = "root";
        } else {
            root = "__graph_root__";
        }
    }

    if (!dag[root]) {
        dag[root] = { key: root, kids: roots.length ? roots : Object.keys(dag) };
    }

    if (root === "__graph_root__") {
        dag[root] = {
            key: root,
            label: "All roots",
            kids: roots.length ? roots : Object.keys(dag),
            synthetic: true,
        };
    }

    ResetCoordinates(dag);
    BuildCoordinateForDag(dag, root);

    const reachable = CollectReachableNodes(dag, root);
    return { dag, root, reachable };
}

function EnsureReferencedNodesExist(dag) {
    Object.keys(dag).forEach(nodeKey => {
        const kids = dag[nodeKey].kids || [];
        const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);

        kidKeys.forEach(kidKey => {
            if (!dag[kidKey]) {
                dag[kidKey] = { key: kidKey, kids: [] };
            }
        });
    });
}

function ResetCoordinates(dag) {
    Object.keys(dag).forEach(key => {
        delete dag[key].coordinate;
    });
}

function CollectReachableNodes(dag, root) {
    const visited = new Set();
    const stack = [root];

    while (stack.length) {
        const nodeKey = stack.pop();
        if (visited.has(nodeKey) || !dag[nodeKey]) {
            continue;
        }

        visited.add(nodeKey);
        const kids = dag[nodeKey].kids || [];
        const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);
        kidKeys.forEach(kidKey => stack.push(kidKey));
    }

    return visited;
}

function BuildStageData(dag, reachable, root) {
    const nodeKeys = Array.from(reachable).filter(key => dag[key] && dag[key].coordinate);
    const nodesByLayer = new Map();
    const nodeMap = {};
    const edgeData = [];

    nodeKeys.forEach(nodeKey => {
        const node = dag[nodeKey];
        const [layer, order] = node.coordinate;
        const visual = GetNodeVisual(nodeKey, node, root);

        if (!nodesByLayer.has(layer)) {
            nodesByLayer.set(layer, []);
        }

        const nodeData = {
            key: nodeKey,
            layer,
            order,
            title: visual.title,
            subtitle: visual.subtitle,
            meta: visual.meta,
            width: visual.width,
            height: GRAPH_THEME.nodeHeight,
            isRoot: nodeKey === root,
        };

        nodesByLayer.get(layer).push(nodeData);
        nodeMap[nodeKey] = nodeData;
    });

    const sortedLayers = Array.from(nodesByLayer.keys()).sort((a, b) => a - b);

    sortedLayers.forEach(layer => {
        const layerNodes = nodesByLayer.get(layer).sort((a, b) => a.order - b.order);
        const layerHeight = layerNodes.length * GRAPH_THEME.nodeHeight + Math.max(layerNodes.length - 1, 0) * GRAPH_THEME.rowGap;
        const stageHeight = MeasureStageHeight(nodesByLayer);
        const startY = GRAPH_THEME.stagePaddingY + (stageHeight - layerHeight) / 2;

        layerNodes.forEach((nodeData, index) => {
            nodeData.y = startY + index * (GRAPH_THEME.nodeHeight + GRAPH_THEME.rowGap) + GRAPH_THEME.nodeHeight / 2;
        });
    });

    const columnWidths = sortedLayers.map(layer => {
        const layerNodes = nodesByLayer.get(layer);
        return Math.max(...layerNodes.map(node => node.width));
    });

    let cursorX = GRAPH_THEME.stagePaddingX;
    sortedLayers.forEach((layer, index) => {
        const layerWidth = columnWidths[index];
        const layerNodes = nodesByLayer.get(layer);

        layerNodes.forEach(nodeData => {
            nodeData.x = cursorX + layerWidth / 2;
        });

        cursorX += layerWidth + GRAPH_THEME.columnGap;
    });

    nodeKeys.forEach(sourceKey => {
        const sourceNode = dag[sourceKey];
        const kids = sourceNode.kids || [];
        const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);

        kidKeys.forEach(targetKey => {
            if (!nodeMap[targetKey]) {
                return;
            }

            const weight = Array.isArray(kids) ? 1 : kids[targetKey];
            edgeData.push({
                id: `${sourceKey}-->${targetKey}`,
                source: sourceKey,
                target: targetKey,
                weight,
                label: GetEdgeLabel(weight),
            });
        });
    });

    const stageWidth = cursorX - GRAPH_THEME.columnGap + GRAPH_THEME.stagePaddingX;
    const stageHeight = MeasureStageHeight(nodesByLayer) + GRAPH_THEME.stagePaddingY * 2;

    return {
        dag,
        root,
        nodeMap,
        nodes: Object.values(nodeMap),
        edges: edgeData,
        stageWidth: Math.max(stageWidth, 960),
        stageHeight: Math.max(stageHeight, 560),
    };
}

function MeasureStageHeight(nodesByLayer) {
    let maxHeight = 0;

    nodesByLayer.forEach(layerNodes => {
        const layerHeight = layerNodes.length * GRAPH_THEME.nodeHeight + Math.max(layerNodes.length - 1, 0) * GRAPH_THEME.rowGap;
        maxHeight = Math.max(maxHeight, layerHeight);
    });

    return Math.max(maxHeight, GRAPH_THEME.nodeHeight * 3);
}

function GetNodeVisual(nodeKey, node, root) {
    if (node.synthetic && nodeKey === "__graph_root__") {
        return {
            title: "All roots",
            subtitle: "Synthetic entry",
            meta: `${CountKids(node)} root branches`,
            width: 188,
        };
    }

    const title = (node.label || node.title || node.name || nodeKey)
        .split("\\")
        .pop()
        .split("/")
        .pop()
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const metaParts = [];
    const parentCount = Array.isArray(node.parents) ? node.parents.length : 0;
    const kidCount = CountKids(node);

    if (node.time) {
        metaParts.push(Array.isArray(node.time) ? node.time.join(" - ") : String(node.time));
    }
    if (node.space) {
        metaParts.push(Array.isArray(node.space) ? node.space.slice(0, 2).join(", ") : String(node.space));
    }
    if (!metaParts.length) {
        metaParts.push(`${parentCount} in / ${kidCount} out`);
    }

    const subtitle = nodeKey === root ? "Current focus" : `${kidCount} downstream`;
    const longestLine = Math.max(title.length, metaParts[0].length, subtitle.length);
    const width = Clamp(132 + longestLine * 6.4, GRAPH_THEME.minNodeWidth, GRAPH_THEME.maxNodeWidth);

    return {
        title: title || nodeKey,
        subtitle,
        meta: metaParts[0],
        width,
    };
}

function CountKids(node) {
    const kids = node.kids || [];
    return Array.isArray(kids) ? kids.length : Object.keys(kids).length;
}

function GetEdgeLabel(weight) {
    if (weight === undefined || weight === null || weight === "" || weight === 1) {
        return "";
    }

    return String(weight);
}

function MountGraph(stageData) {
    const container = document.getElementById("main-content");
    const emptyState = document.getElementById("empty-state");

    container.innerHTML = "";
    container.classList.add("is-ready");
    emptyState.classList.add("is-hidden");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${stageData.stageWidth} ${stageData.stageHeight}`);
    svg.setAttribute("width", String(stageData.stageWidth));
    svg.setAttribute("height", String(stageData.stageHeight));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `DAG view focused on ${stageData.root}`);

    svg.appendChild(BuildDefs());
    svg.appendChild(BuildStageBackdrop(stageData));

    const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    edgeLayer.setAttribute("class", "graph-edge-layer");

    stageData.edges.forEach(edge => {
        edgeLayer.appendChild(BuildEdge(stageData, edge));
    });

    const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodeLayer.setAttribute("class", "graph-node-layer");

    stageData.nodes.forEach(node => {
        nodeLayer.appendChild(BuildNode(stageData, node));
    });

    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);
    container.appendChild(svg);

    container.scrollLeft = 0;
    container.scrollTop = Math.max((stageData.stageHeight - container.clientHeight) / 2, 0);
}

function BuildDefs() {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");

    const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    markerPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    markerPath.setAttribute("fill", "#6f83aa");
    markerPath.setAttribute("fill-opacity", "0.48");
    marker.appendChild(markerPath);

    defs.appendChild(marker);
    return defs;
}

function BuildStageBackdrop(stageData) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "graph-stage");

    const halo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    halo.setAttribute("class", "graph-stage__halo");
    halo.setAttribute("x", "28");
    halo.setAttribute("y", "28");
    halo.setAttribute("width", String(stageData.stageWidth - 56));
    halo.setAttribute("height", String(stageData.stageHeight - 56));
    halo.setAttribute("rx", "30");
    halo.setAttribute("ry", "30");

    group.appendChild(halo);
    return group;
}

function BuildEdge(stageData, edge) {
    const sourceNode = stageData.nodeMap[edge.source];
    const targetNode = stageData.nodeMap[edge.target];
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const startX = sourceNode.x + sourceNode.width / 2 - 6;
    const startY = sourceNode.y;
    const endX = targetNode.x - targetNode.width / 2 + 6;
    const endY = targetNode.y;
    const bend = Math.max((endX - startX) * 0.55, 52);
    const d = [
        `M ${startX} ${startY}`,
        `C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
    ].join(" ");

    path.setAttribute("class", "graph-edge");
    path.setAttribute("d", d);
    path.setAttribute("data-source", edge.source);
    path.setAttribute("data-target", edge.target);
    path.setAttribute("marker-end", "url(#arrowhead)");

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.appendChild(path);

    if (edge.label) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "graph-edge-label");
        label.setAttribute("x", String((startX + endX) / 2));
        label.setAttribute("y", String((startY + endY) / 2 - 8));
        label.setAttribute("text-anchor", "middle");
        label.textContent = edge.label;
        group.appendChild(label);
    }

    return group;
}

function BuildNode(stageData, nodeData) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `graph-node${nodeData.isRoot ? " is-root is-active" : ""}`);
    group.setAttribute("data-node-key", nodeData.key);
    group.setAttribute("transform", `translate(${nodeData.x - nodeData.width / 2}, ${nodeData.y - nodeData.height / 2})`);

    const shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("class", "graph-node__shape");
    shape.setAttribute("width", String(nodeData.width));
    shape.setAttribute("height", String(nodeData.height));
    shape.setAttribute("rx", "18");
    shape.setAttribute("ry", "18");

    const accent = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    accent.setAttribute("class", "graph-node__accent");
    accent.setAttribute("x", "12");
    accent.setAttribute("y", "12");
    accent.setAttribute("width", "30");
    accent.setAttribute("height", String(nodeData.height - 24));
    accent.setAttribute("rx", "12");
    accent.setAttribute("ry", "12");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("class", "graph-node__title");
    title.setAttribute("x", "56");
    title.setAttribute("y", "32");
    title.textContent = Truncate(nodeData.title, 28);

    const meta = document.createElementNS("http://www.w3.org/2000/svg", "text");
    meta.setAttribute("class", "graph-node__meta");
    meta.setAttribute("x", "56");
    meta.setAttribute("y", "52");
    meta.textContent = Truncate(nodeData.meta, 32);

    const subtitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subtitle.setAttribute("class", "graph-node__subtitle");
    subtitle.setAttribute("x", "56");
    subtitle.setAttribute("y", "68");
    subtitle.textContent = Truncate(nodeData.subtitle, 28);

    const cta = document.createElementNS("http://www.w3.org/2000/svg", "text");
    cta.setAttribute("class", "graph-node__cta");
    cta.setAttribute("x", String(nodeData.width - 16));
    cta.setAttribute("y", "32");
    cta.setAttribute("text-anchor", "end");
    cta.textContent = nodeData.isRoot ? "Focus" : "Open";

    group.appendChild(shape);
    group.appendChild(accent);
    group.appendChild(title);
    group.appendChild(meta);
    group.appendChild(subtitle);
    group.appendChild(cta);

    group.addEventListener("mouseenter", () => ApplyHoverState(nodeData.key));
    group.addEventListener("mouseleave", () => ApplyHoverState(null));
    group.addEventListener("click", () => {
        if (GRAPH_STATE.currentRoot !== nodeData.key) {
            RenderSvgFromDag(nodeData.key, true);
        }
    });

    return group;
}

function ApplyHoverState(nodeKey) {
    const allNodes = document.querySelectorAll(".graph-node");
    const allEdges = document.querySelectorAll(".graph-edge");

    if (!nodeKey) {
        allNodes.forEach(node => node.classList.remove("is-hovered", "is-active", "is-dimmed"));
        allEdges.forEach(edge => edge.classList.remove("is-active", "is-dimmed"));

        allNodes.forEach(node => {
            if (node.dataset.nodeKey === GRAPH_STATE.currentRoot) {
                node.classList.add("is-active");
            }
        });

        return;
    }

    const connectedNodes = new Set([nodeKey]);

    allEdges.forEach(edge => {
        const source = edge.dataset.source;
        const target = edge.dataset.target;
        const isConnected = source === nodeKey || target === nodeKey;
        edge.classList.toggle("is-active", isConnected);
        edge.classList.toggle("is-dimmed", !isConnected);

        if (isConnected) {
            connectedNodes.add(source);
            connectedNodes.add(target);
        }
    });

    allNodes.forEach(node => {
        const isCurrent = node.dataset.nodeKey === nodeKey;
        const isConnected = connectedNodes.has(node.dataset.nodeKey);
        node.classList.toggle("is-hovered", isCurrent);
        node.classList.toggle("is-active", isCurrent || node.dataset.nodeKey === GRAPH_STATE.currentRoot);
        node.classList.toggle("is-dimmed", !isConnected);
    });
}

function UpdateChrome(stageData) {
    const summary = document.getElementById("graph-summary");
    const backButton = document.getElementById("back-btn");
    const emptyMessage = document.getElementById("empty-state-message");

    const edgeCount = stageData.edges.length;
    const nodeCount = stageData.nodes.length;
    const focusLabel = GetDisplayLabel(stageData.root, stageData.dag[stageData.root]);

    summary.textContent = `Focused on ${focusLabel}. Showing ${nodeCount} nodes and ${edgeCount} links in this reachable subgraph.`;
    backButton.disabled = GRAPH_STATE.history.length === 0;
    emptyMessage.textContent = "Import a JSON file to render a focused DAG view with drill-down navigation.";
}

function GetDisplayLabel(nodeKey, node) {
    if (node && node.synthetic && nodeKey === "__graph_root__") {
        return "All roots";
    }

    return (node && (node.label || node.title || node.name || nodeKey) || nodeKey)
        .split("\\")
        .pop()
        .split("/")
        .pop()
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ");
}

function StructuredClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function Clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function Truncate(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1)}...`;
}
