(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});

    function normalizeDagInput(input) {
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
            return normalizeDagInput(input.nodes);
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

    function findRootsFromDag(dag) {
        const allNodes = new Set(Object.keys(dag));

        Object.keys(dag).forEach(nodeKey => {
            const kids = dag[nodeKey].kids || [];
            const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);

            kidKeys.forEach(kidKey => {
                allNodes.delete(kidKey);
            });
        });

        return Array.from(allNodes);
    }

    function ensureReferencedNodesExist(dag) {
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

    GraphApp.normalize = {
        normalizeDagInput,
        findRootsFromDag,
        ensureReferencedNodesExist,
    };
})();
