(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});

    function buildStageData(sourceDag, requestedRoot) {
        if (!sourceDag) {
            return null;
        }

        const stateModule = GraphApp.state;
        const normalizeModule = GraphApp.normalize;
        const theme = stateModule.theme;
        const utils = stateModule.utils;
        const dag = utils.structuredCloneValue(sourceDag);

        normalizeModule.ensureReferencedNodesExist(dag);

        const roots = normalizeModule.findRootsFromDag(dag);
        const root = resolveRootKey(dag, roots, requestedRoot);

        if (!dag[root]) {
            dag[root] = { key: root, kids: roots.length ? roots : Object.keys(dag) };
        }

        if (root === "__graph_root__") {
            dag[root] = {
                key: root,
                label: "All roots",
                kids: roots.length ? roots : Object.keys(dag).filter(key => key !== root),
                synthetic: true,
            };
        }

        resetCoordinates(dag);
        buildCoordinates(dag, root);

        const reachable = collectReachableNodes(dag, root);
        const nodeKeys = Array.from(reachable).filter(key => dag[key] && dag[key].coordinate);
        const nodesByLayer = new Map();
        const nodeMap = {};
        const edgeData = [];
        const incomingMap = buildIncomingMap(dag, nodeKeys);

        nodeKeys.forEach(nodeKey => {
            const node = dag[nodeKey];
            const [layer, order] = node.coordinate;
            const visual = getNodeVisual(nodeKey, node);

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
                height: theme.nodeHeight,
                isRoot: nodeKey === root,
            };

            nodesByLayer.get(layer).push(nodeData);
            nodeMap[nodeKey] = nodeData;
        });

        const sortedLayers = Array.from(nodesByLayer.keys()).sort((a, b) => a - b);
        const stageInnerHeight = measureStageInnerHeight(nodesByLayer);

        sortedLayers.forEach(layer => {
            const layerNodes = nodesByLayer.get(layer).sort((a, b) => a.order - b.order);
            if (layer > 0) {
                layerNodes.sort((a, b) => {
                    const aScore = getBarycentricScore(a.key, incomingMap, nodeMap);
                    const bScore = getBarycentricScore(b.key, incomingMap, nodeMap);

                    if (aScore === bScore) {
                        return a.order - b.order;
                    }

                    return aScore - bScore;
                });
            }

            layerNodes.forEach((nodeData, index) => {
                nodeData.order = index;
            });

            const layerHeight = layerNodes.length * theme.nodeHeight + Math.max(layerNodes.length - 1, 0) * theme.rowGap;
            const startY = theme.stagePaddingY + (stageInnerHeight - layerHeight) / 2;

            layerNodes.forEach((nodeData, index) => {
                nodeData.y = startY + index * (theme.nodeHeight + theme.rowGap) + theme.nodeHeight / 2;
            });
        });

        const columnWidths = sortedLayers.map(layer => {
            const layerNodes = nodesByLayer.get(layer);
            return Math.max(...layerNodes.map(node => node.width));
        });

        let cursorX = theme.stagePaddingX;
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

            cursorX += layerWidth + theme.columnGap;
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
                    label: getEdgeLabel(weight),
                });
            });
        });

        const stageWidth = cursorX - theme.columnGap + theme.stagePaddingX;
        const stageHeight = stageInnerHeight + theme.stagePaddingY * 2;

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

    function resolveRootKey(dag, roots, requestedRoot) {
        let root = requestedRoot;

        if (!root || !dag[root]) {
            if (roots.length === 1) {
                root = roots[0];
            } else if (dag.root) {
                root = "root";
            } else {
                root = "__graph_root__";
            }
        }

        return root;
    }

    function resetCoordinates(dag) {
        Object.keys(dag).forEach(key => {
            delete dag[key].coordinate;
        });
    }

    function buildCoordinates(dag, root) {
        const queue = [root];
        const visited = new Set([root]);
        let level = -1;

        while (queue.length) {
            const levelCount = queue.length;
            level += 1;

            for (let index = 0; index < levelCount; index += 1) {
                const key = queue.shift();
                dag[key].coordinate = [level, index];

                const kids = dag[key].kids || [];
                const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);

                kidKeys.forEach(kidKey => {
                    if (!dag[kidKey]) {
                        dag[kidKey] = { key: kidKey, kids: [] };
                    }

                    if (!visited.has(kidKey)) {
                        visited.add(kidKey);
                        queue.push(kidKey);
                    }
                });
            }
        }
    }

    function collectReachableNodes(dag, root) {
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

    function buildIncomingMap(dag, nodeKeys) {
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

    function getBarycentricScore(nodeKey, incomingMap, nodeMap) {
        const parents = incomingMap[nodeKey] || [];
        if (!parents.length) {
            return nodeMap[nodeKey].order;
        }

        const total = parents.reduce((sum, parentKey) => sum + (nodeMap[parentKey] ? nodeMap[parentKey].order : 0), 0);
        return total / parents.length;
    }

    function measureStageInnerHeight(nodesByLayer) {
        const theme = GraphApp.state.theme;
        let maxHeight = 0;

        nodesByLayer.forEach(layerNodes => {
            const layerHeight = layerNodes.length * theme.nodeHeight + Math.max(layerNodes.length - 1, 0) * theme.rowGap;
            maxHeight = Math.max(maxHeight, layerHeight);
        });

        return Math.max(maxHeight, theme.nodeHeight * 3.4);
    }

    function getNodeVisual(nodeKey, node) {
        const theme = GraphApp.state.theme;
        const utils = GraphApp.state.utils;

        if (node.synthetic && nodeKey === "__graph_root__") {
            return {
                title: "All roots",
                detail: "Combined entry point for every detected root branch.",
                width: 232,
            };
        }

        const title = utils.sanitizeNodeLabel(node.label || node.title || node.name || nodeKey);
        const detail = getNodeDetail(node, title);
        const longestLine = Math.max(title.length, detail.length * 0.76);
        const width = utils.clamp(132 + longestLine * 6.1, theme.minNodeWidth, theme.maxNodeWidth);

        return {
            title: title || nodeKey,
            detail,
            width,
        };
    }

    function getNodeDetail(node, fallbackTitle) {
        const defineText = stripRichText(node.define || "");
        const propertyText = Array.isArray(node.properties) ? stripRichText(node.properties.find(Boolean) || "") : "";
        const detail = firstMeaningfulSegment(defineText) || firstMeaningfulSegment(propertyText) || fallbackTitle;
        return GraphApp.state.utils.truncate(detail, 52);
    }

    function stripRichText(text) {
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

    function firstMeaningfulSegment(text) {
        if (!text) {
            return "";
        }

        const segments = text
            .split(/[.?!:;]\s+|\s{2,}/)
            .map(segment => segment.trim())
            .filter(Boolean);

        return segments.find(segment => /[A-Za-z\u4e00-\u9fff]/.test(segment)) || "";
    }

    function getEdgeLabel(weight) {
        if (weight === undefined || weight === null || weight === "" || weight === 1) {
            return "";
        }

        return String(weight);
    }

    GraphApp.layout = {
        buildStageData,
    };
})();
