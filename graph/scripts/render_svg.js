const GRAPH_STATE = {
    rawData: null,
    normalizedDag: null,
    currentRoot: null,
    history: [],
};

const GRAPH_THEME = {
    stagePaddingX: 108,
    stagePaddingY: 88,
    columnGap: 116,
    rowGap: 22,
    nodeHeight: 74,
    minNodeWidth: 188,
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
    const incomingMap = BuildIncomingMap(dag, nodeKeys);

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
            detail: visual.detail,
            width: visual.width,
            height: GRAPH_THEME.nodeHeight,
            isRoot: nodeKey === root,
        };

        nodesByLayer.get(layer).push(nodeData);
        nodeMap[nodeKey] = nodeData;
    });

    const sortedLayers = Array.from(nodesByLayer.keys()).sort((a, b) => a - b);
    const stageInnerHeight = MeasureStageInnerHeight(nodesByLayer);

    sortedLayers.forEach(layer => {
        const layerNodes = nodesByLayer.get(layer).sort((a, b) => a.order - b.order);
        if (layer > 0) {
            layerNodes.sort((a, b) => {
                const aScore = GetBarycentricScore(a.key, incomingMap, nodeMap);
                const bScore = GetBarycentricScore(b.key, incomingMap, nodeMap);

                if (aScore === bScore) {
                    return a.order - b.order;
                }

                return aScore - bScore;
            });
        }

        layerNodes.forEach((nodeData, index) => {
            nodeData.order = index;
        });

        const layerHeight = layerNodes.length * GRAPH_THEME.nodeHeight + Math.max(layerNodes.length - 1, 0) * GRAPH_THEME.rowGap;
        const startY = GRAPH_THEME.stagePaddingY + (stageInnerHeight - layerHeight) / 2;

        layerNodes.forEach((nodeData, index) => {
            nodeData.y = startY + index * (GRAPH_THEME.nodeHeight + GRAPH_THEME.rowGap) + GRAPH_THEME.nodeHeight / 2;
        });
    });

    const columnWidths = sortedLayers.map(layer => {
        const layerNodes = nodesByLayer.get(layer);
        return Math.max(...layerNodes.map(node => node.width));
    });

    let cursorX = GRAPH_THEME.stagePaddingX;
    const laneData = [];

    sortedLayers.forEach((layer, index) => {
        const layerWidth = columnWidths[index];
        const layerNodes = nodesByLayer.get(layer);
        const laneCenter = cursorX + layerWidth / 2;

        layerNodes.forEach(nodeData => {
            nodeData.x = laneCenter;
        });

        laneData.push({
            layer,
            label: layer === 0 ? "Focus" : `Tier ${layer}`,
            x: laneCenter,
            width: layerWidth,
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
    const stageHeight = stageInnerHeight + GRAPH_THEME.stagePaddingY * 2;

    return {
        dag,
        root,
        nodeMap,
        nodes: Object.values(nodeMap),
        edges: edgeData,
        lanes: laneData,
        stageWidth: Math.max(stageWidth, 980),
        stageHeight: Math.max(stageHeight, 600),
    };
}

function BuildIncomingMap(dag, nodeKeys) {
    const visibleKeys = new Set(nodeKeys);
    const incomingMap = {};

    nodeKeys.forEach(nodeKey => {
        incomingMap[nodeKey] = [];
    });

    nodeKeys.forEach(sourceKey => {
        const kids = dag[sourceKey].kids || [];
        const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);

        kidKeys.forEach(targetKey => {
            if (visibleKeys.has(targetKey)) {
                incomingMap[targetKey].push(sourceKey);
            }
        });
    });

    return incomingMap;
}

function GetBarycentricScore(nodeKey, incomingMap, nodeMap) {
    const parents = incomingMap[nodeKey] || [];
    if (!parents.length) {
        return nodeMap[nodeKey].order;
    }

    const total = parents.reduce((sum, parentKey) => sum + (nodeMap[parentKey] ? nodeMap[parentKey].order : 0), 0);
    return total / parents.length;
}

function MeasureStageInnerHeight(nodesByLayer) {
    let maxHeight = 0;

    nodesByLayer.forEach(layerNodes => {
        const layerHeight = layerNodes.length * GRAPH_THEME.nodeHeight + Math.max(layerNodes.length - 1, 0) * GRAPH_THEME.rowGap;
        maxHeight = Math.max(maxHeight, layerHeight);
    });

    return Math.max(maxHeight, GRAPH_THEME.nodeHeight * 3.4);
}

function GetNodeVisual(nodeKey, node, root) {
    if (node.synthetic && nodeKey === "__graph_root__") {
        return {
            title: "All roots",
            detail: "Combined entry point for every detected root branch.",
            width: 232,
        };
    }

    const title = SanitizeNodeLabel(node.label || node.title || node.name || nodeKey);
    const detail = GetNodeDetail(node, title);
    const longestLine = Math.max(title.length, detail.length * 0.76);
    const width = Clamp(132 + longestLine * 6.1, GRAPH_THEME.minNodeWidth, GRAPH_THEME.maxNodeWidth);

    return {
        title: title || nodeKey,
        detail,
        width,
    };
}

function CountKids(node) {
    const kids = node.kids || [];
    return Array.isArray(kids) ? kids.length : Object.keys(kids).length;
}

function GetNodeDetail(node, fallbackTitle) {
    const defineText = StripRichText(node.define || "");
    const propertyText = Array.isArray(node.properties) ? StripRichText(node.properties.find(Boolean) || "") : "";
    const detail = FirstMeaningfulSegment(defineText) || FirstMeaningfulSegment(propertyText) || fallbackTitle;
    return Truncate(detail, 52);
}

function StripRichText(text) {
    return String(text || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\$\$[\s\S]*?\$\$/g, " ")
        .replace(/\$[^$\n]+\$/g, " ")
        .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
        .replace(/<img[^>]*>/gi, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[`*_>#|-]/g, " ")
        .replace(/\bhttps?:\/\/\S+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function FirstMeaningfulSegment(text) {
    if (!text) {
        return "";
    }

    const segments = text
        .split(/[.?!:;]\s+|\s{2,}/)
        .map(segment => segment.trim())
        .filter(Boolean);

    return segments.find(segment => /[A-Za-z\u4e00-\u9fff]/.test(segment)) || "";
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
        nodeLayer.appendChild(BuildNode(node));
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
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "4");

    const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    markerPath.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
    markerPath.setAttribute("fill", "#788bb3");
    markerPath.setAttribute("fill-opacity", "0.36");
    marker.appendChild(markerPath);
    defs.appendChild(marker);

    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "soft-glow");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    blur.setAttribute("stdDeviation", "10");
    filter.appendChild(blur);
    defs.appendChild(filter);

    return defs;
}

function BuildStageBackdrop(stageData) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "graph-stage");

    const halo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    halo.setAttribute("class", "graph-stage__halo");
    halo.setAttribute("x", "24");
    halo.setAttribute("y", "24");
    halo.setAttribute("width", String(stageData.stageWidth - 48));
    halo.setAttribute("height", String(stageData.stageHeight - 48));
    halo.setAttribute("rx", "28");
    halo.setAttribute("ry", "28");
    group.appendChild(halo);

    stageData.lanes.forEach(lane => {
        const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
        guide.setAttribute("class", "graph-stage__lane");
        guide.setAttribute("x1", String(lane.x));
        guide.setAttribute("y1", "54");
        guide.setAttribute("x2", String(lane.x));
        guide.setAttribute("y2", String(stageData.stageHeight - 54));
        group.appendChild(guide);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "graph-stage__lane-label");
        label.setAttribute("x", String(lane.x));
        label.setAttribute("y", "42");
        label.setAttribute("text-anchor", "middle");
        label.textContent = lane.label;
        group.appendChild(label);
    });

    const rootNode = stageData.nodeMap[stageData.root];
    if (rootNode) {
        const focus = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        focus.setAttribute("class", "graph-stage__focus");
        focus.setAttribute("cx", String(rootNode.x));
        focus.setAttribute("cy", String(rootNode.y));
        focus.setAttribute("rx", String(rootNode.width * 0.9));
        focus.setAttribute("ry", "92");
        focus.setAttribute("filter", "url(#soft-glow)");
        group.appendChild(focus);
    }

    return group;
}

function BuildEdge(stageData, edge) {
    const sourceNode = stageData.nodeMap[edge.source];
    const targetNode = stageData.nodeMap[edge.target];
    const startX = sourceNode.x + sourceNode.width / 2 - 8;
    const startY = sourceNode.y;
    const endX = targetNode.x - targetNode.width / 2 + 8;
    const endY = targetNode.y;
    const bend = Math.max((endX - startX) * 0.58, 56);
    const d = [
        `M ${startX} ${startY}`,
        `C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
    ].join(" ");

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "graph-edge-group");

    const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    glow.setAttribute("class", "graph-edge-glow");
    glow.setAttribute("d", d);
    group.appendChild(glow);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "graph-edge");
    path.setAttribute("d", d);
    path.setAttribute("data-source", edge.source);
    path.setAttribute("data-target", edge.target);
    path.setAttribute("marker-end", "url(#arrowhead)");
    group.appendChild(path);

    if (edge.label) {
        const labelX = (startX + endX) / 2;
        const labelY = (startY + endY) / 2 - 9;
        const labelWidth = Math.max(18, edge.label.length * 7 + 10);

        const labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        labelBg.setAttribute("class", "graph-edge-label-bg");
        labelBg.setAttribute("x", String(labelX - labelWidth / 2));
        labelBg.setAttribute("y", String(labelY - 10));
        labelBg.setAttribute("width", String(labelWidth));
        labelBg.setAttribute("height", "16");
        labelBg.setAttribute("rx", "8");
        labelBg.setAttribute("ry", "8");
        group.appendChild(labelBg);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "graph-edge-label");
        label.setAttribute("x", String(labelX));
        label.setAttribute("y", String(labelY + 1));
        label.setAttribute("text-anchor", "middle");
        label.textContent = edge.label;
        group.appendChild(label);
    }

    return group;
}

function BuildNode(nodeData) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `graph-node${nodeData.isRoot ? " is-root is-active" : ""}`);
    group.setAttribute("data-node-key", nodeData.key);
    group.setAttribute("transform", `translate(${nodeData.x - nodeData.width / 2}, ${nodeData.y - nodeData.height / 2})`);
    group.setAttribute("tabindex", "0");
    group.setAttribute("focusable", "true");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${nodeData.title}. ${nodeData.detail}. ${nodeData.isRoot ? "Current focus." : "Activate to focus this branch."}`);

    const glow = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    glow.setAttribute("class", "graph-node__glow");
    glow.setAttribute("cx", String(nodeData.width / 2));
    glow.setAttribute("cy", String(nodeData.height / 2));
    glow.setAttribute("rx", String(nodeData.width / 2 + 16));
    glow.setAttribute("ry", String(nodeData.height / 2 + 10));

    const shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    shape.setAttribute("class", "graph-node__shape");
    shape.setAttribute("width", String(nodeData.width));
    shape.setAttribute("height", String(nodeData.height));
    shape.setAttribute("rx", "24");
    shape.setAttribute("ry", "24");

    const pin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pin.setAttribute("class", "graph-node__pin");
    pin.setAttribute("cx", "26");
    pin.setAttribute("cy", String(nodeData.height / 2));
    pin.setAttribute("r", "11");

    const pinCore = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pinCore.setAttribute("class", "graph-node__pin-core");
    pinCore.setAttribute("cx", "26");
    pinCore.setAttribute("cy", String(nodeData.height / 2));
    pinCore.setAttribute("r", "4");

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("class", "graph-node__title");
    title.setAttribute("x", "48");
    title.setAttribute("y", "29");
    title.textContent = Truncate(nodeData.title, 24);

    const detail = document.createElementNS("http://www.w3.org/2000/svg", "text");
    detail.setAttribute("class", "graph-node__detail");
    detail.setAttribute("x", "48");
    detail.setAttribute("y", "43");
    detail.textContent = Truncate(nodeData.detail, 34);

    const affordance = document.createElementNS("http://www.w3.org/2000/svg", "g");
    affordance.setAttribute("class", "graph-node__affordance");

    const affordanceBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    affordanceBg.setAttribute("class", "graph-node__affordance-bg");
    affordanceBg.setAttribute("x", String(nodeData.width - 90));
    affordanceBg.setAttribute("y", String(nodeData.height - 21));
    affordanceBg.setAttribute("width", "74");
    affordanceBg.setAttribute("height", "14");
    affordanceBg.setAttribute("rx", "7");
    affordanceBg.setAttribute("ry", "7");

    const affordanceText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    affordanceText.setAttribute("class", "graph-node__affordance-text");
    affordanceText.setAttribute("x", String(nodeData.width - 53));
    affordanceText.setAttribute("y", String(nodeData.height - 10));
    affordanceText.setAttribute("text-anchor", "middle");
    affordanceText.textContent = nodeData.isRoot ? "Focused" : "Refocus";

    affordance.appendChild(affordanceBg);
    affordance.appendChild(affordanceText);

    group.appendChild(glow);
    group.appendChild(shape);
    group.appendChild(pin);
    group.appendChild(pinCore);
    group.appendChild(title);
    group.appendChild(detail);
    group.appendChild(affordance);

    group.addEventListener("mouseenter", () => ApplyHoverState(nodeData.key));
    group.addEventListener("mouseleave", () => {
        if (!group.classList.contains("is-focused")) {
            ApplyHoverState(null);
        }
    });
    group.addEventListener("focus", () => {
        group.classList.add("is-focused");
        ApplyHoverState(nodeData.key);
    });
    group.addEventListener("blur", () => {
        group.classList.remove("is-focused");
        ApplyHoverState(null);
    });
    group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (GRAPH_STATE.currentRoot !== nodeData.key) {
                RenderSvgFromDag(nodeData.key, true);
            }
        }
    });
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

    summary.textContent = `Focused on ${focusLabel}. ${nodeCount} nodes and ${edgeCount} links are visible in this branch map.`;
    backButton.disabled = GRAPH_STATE.history.length === 0;
    emptyMessage.textContent = "Import a JSON file to render a focused DAG view with drill-down navigation.";
}

function GetDisplayLabel(nodeKey, node) {
    if (node && node.synthetic && nodeKey === "__graph_root__") {
        return "All roots";
    }

    return SanitizeNodeLabel((node && (node.label || node.title || node.name || nodeKey)) || nodeKey);
}

function SanitizeNodeLabel(text) {
    return String(text)
        .split("\\")
        .pop()
        .split("/")
        .pop()
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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
