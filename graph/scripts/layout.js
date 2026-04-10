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
        const selection = resolveSelection(dag, roots, requestedRoot);
        const root = selection.rootKey;
        const forestTopLevelKeys = selection.topLevelKeys;
        const forestTopLevelSet = new Set(forestTopLevelKeys);

        if (root !== "__graph_root__" && !dag[root]) {
            dag[root] = { key: root, children: roots.length ? roots : Object.keys(dag) };
        }

        if (selection.isForest) {
            dag[root] = {
                key: root,
                label: selection.label,
                children: forestTopLevelKeys,
                synthetic: true,
            };
        }

        resetCoordinates(dag);
        if (selection.isForest) {
            buildCoordinatesFromRoots(dag, forestTopLevelKeys);
        } else {
            buildCoordinates(dag, root);
        }

        const reachable = selection.isForest
            ? collectReachableFromRoots(dag, forestTopLevelKeys)
            : collectReachableNodes(dag, root);
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
                isRoot: selection.isForest ? forestTopLevelSet.has(nodeKey) : nodeKey === root,
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
                label: layer === 0 ? (selection.isForest ? "Root" : "Focus") : `Tier ${layer}`,
                x: laneCenter,
                width: layerWidth,
            });

            cursorX += layerWidth + theme.columnGap;
        });

        nodeKeys.forEach(sourceKey => {
            const sourceNode = dag[sourceKey];
            const children = sourceNode.children || [];
            const childKeys = Array.isArray(children) ? children : Object.keys(children);

            childKeys.forEach(targetKey => {
                if (!nodeMap[targetKey]) {
                    return;
                }

                const weight = Array.isArray(children) ? 1 : children[targetKey];
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
            selection,
            topLevelKeys: forestTopLevelKeys,
            isForest: selection.isForest,
            nodeMap,
            nodes: Object.values(nodeMap),
            edges: edgeData,
            lanes: laneData,
            stageWidth: Math.max(stageWidth, 980),
            stageHeight: Math.max(stageHeight, 600),
        };
    }

    function resolveSelection(dag, roots, requestedRoot) {
        if (requestedRoot && typeof requestedRoot === "object" && requestedRoot.type === "forest") {
            const topLevelKeys = Array.from(new Set((requestedRoot.keys || []).filter(key => dag[key])));
            if (topLevelKeys.length) {
                return {
                    type: "forest",
                    isForest: true,
                    rootKey: "__selection_root__",
                    topLevelKeys,
                    label: requestedRoot.label || "Parent level",
                };
            }
        }

        let root = requestedRoot;
        if (!root || typeof root !== "string" || !dag[root]) {
            if (roots.length === 1) {
                root = roots[0];
            } else {
                root = "__graph_root__";
            }
        }

        return {
            type: "single",
            isForest: root === "__graph_root__",
            rootKey: root,
            topLevelKeys: root === "__graph_root__" ? (roots.length ? roots : Object.keys(dag)) : [root],
            label: root === "__graph_root__" ? "All roots" : root,
        };
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

                const children = dag[key].children || [];
                const childKeys = Array.isArray(children) ? children : Object.keys(children);

                childKeys.forEach(childKey => {
                    if (!dag[childKey]) {
                        dag[childKey] = { key: childKey, children: [] };
                    }

                    if (!visited.has(childKey)) {
                        visited.add(childKey);
                        queue.push(childKey);
                    }
                });
            }
        }
    }

    function buildCoordinatesFromRoots(dag, roots) {
        const queue = roots.slice();
        const visited = new Set(queue);
        let level = -1;

        while (queue.length) {
            const levelCount = queue.length;
            level += 1;

            for (let index = 0; index < levelCount; index += 1) {
                const key = queue.shift();
                if (!dag[key]) {
                    continue;
                }

                dag[key].coordinate = [level, index];

                const children = dag[key].children || [];
                const childKeys = Array.isArray(children) ? children : Object.keys(children);
                childKeys.forEach(childKey => {
                    if (!dag[childKey]) {
                        dag[childKey] = { key: childKey, children: [] };
                    }

                    if (!visited.has(childKey)) {
                        visited.add(childKey);
                        queue.push(childKey);
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
            const children = dag[nodeKey].children || [];
            const childKeys = Array.isArray(children) ? children : Object.keys(children);
            childKeys.forEach(childKey => stack.push(childKey));
        }

        return visited;
    }

    function collectReachableFromRoots(dag, roots) {
        const visited = new Set();
        const stack = roots.slice();

        while (stack.length) {
            const nodeKey = stack.pop();
            if (visited.has(nodeKey) || !dag[nodeKey]) {
                continue;
            }

            visited.add(nodeKey);
            const children = dag[nodeKey].children || [];
            const childKeys = Array.isArray(children) ? children : Object.keys(children);
            childKeys.forEach(childKey => stack.push(childKey));
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
            const children = dag[sourceKey].children || [];
            const childKeys = Array.isArray(children) ? children : Object.keys(children);

            childKeys.forEach(targetKey => {
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

        if (node.synthetic) {
            return {
                title: node.label || "Selected roots",
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
        const detail = firstMeaningfulSegment(defineText) || fallbackTitle;
        return detail;
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
