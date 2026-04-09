(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});

    function normalizeDagInput(input) {
        const dag = {};

        if (Array.isArray(input)) {
            input.forEach(item => {
                if (!item || !item.key) {
                    return;
                }

                const key = String(item.key).trim();
                if (!key) {
                    return;
                }

                dag[key] = normalizeNodeValue(key, item);
            });

            return dag;
        }

        if (input && Array.isArray(input.nodes)) {
            return normalizeDagInput(input.nodes);
        }

        if (input && typeof input === "object") {
            Object.entries(input).forEach(([rawKey, value]) => {
                const key = String(rawKey).trim();
                if (!key) {
                    return;
                }

                dag[key] = normalizeNodeValue(key, value || {});
            });
        }

        return dag;
    }

    function normalizeNodeValue(key, value) {
        const nodeValue = value && typeof value === "object" ? { ...value } : {};
        nodeValue.key = key;
        nodeValue.kids = normalizeRelationField(nodeValue.kids);
        nodeValue.parents = normalizeRelationField(nodeValue.parents);

        return nodeValue;
    }

    function normalizeRelationField(value) {
        if (Array.isArray(value)) {
            return uniqueKeys(value.map(item => String(item || "").trim()).filter(Boolean));
        }

        if (value && typeof value === "object") {
            const relationMap = {};
            Object.entries(value).forEach(([rawKey, rawValue]) => {
                const key = String(rawKey || "").trim();
                if (!key) {
                    return;
                }

                relationMap[key] = rawValue;
            });
            return relationMap;
        }

        return {};
    }

    function uniqueKeys(keys) {
        return Array.from(new Set(keys.filter(Boolean)));
    }

    function getRelationKeys(relationValue) {
        if (Array.isArray(relationValue)) {
            return uniqueKeys(relationValue.map(item => String(item || "").trim()).filter(Boolean));
        }

        if (relationValue && typeof relationValue === "object") {
            return Object.keys(relationValue).filter(Boolean);
        }

        return [];
    }

    function hasRelationKey(relationValue, key) {
        const targetKey = String(key || "").trim();
        if (!targetKey) {
            return false;
        }

        if (Array.isArray(relationValue)) {
            return relationValue.includes(targetKey);
        }

        if (relationValue && typeof relationValue === "object") {
            return Object.prototype.hasOwnProperty.call(relationValue, targetKey);
        }

        return false;
    }

    function addRelationKey(node, fieldName, relationKey, relationValue) {
        if (!node || !fieldName) {
            return;
        }

        const targetKey = String(relationKey || "").trim();
        if (!targetKey) {
            return;
        }

        const currentValue = node[fieldName];
        if (Array.isArray(currentValue)) {
            if (!currentValue.includes(targetKey)) {
                currentValue.push(targetKey);
            }
            return;
        }

        const relationMap = currentValue && typeof currentValue === "object" ? currentValue : {};
        if (!Object.prototype.hasOwnProperty.call(relationMap, targetKey)) {
            relationMap[targetKey] = relationValue;
        }
        node[fieldName] = relationMap;
    }

    function removeRelationKey(node, fieldName, relationKey) {
        if (!node || !fieldName) {
            return;
        }

        const targetKey = String(relationKey || "").trim();
        if (!targetKey) {
            return;
        }

        const currentValue = node[fieldName];
        if (Array.isArray(currentValue)) {
            node[fieldName] = currentValue.filter(item => item !== targetKey);
            return;
        }

        if (currentValue && typeof currentValue === "object") {
            delete currentValue[targetKey];
        }
    }

    function renameRelationKey(node, fieldName, oldKey, newKey) {
        if (!node || !fieldName) {
            return;
        }

        const sourceKey = String(oldKey || "").trim();
        const targetKey = String(newKey || "").trim();
        if (!sourceKey || !targetKey || sourceKey === targetKey) {
            return;
        }

        const currentValue = node[fieldName];
        if (Array.isArray(currentValue)) {
            node[fieldName] = uniqueKeys(currentValue.map(item => (item === sourceKey ? targetKey : item)));
            return;
        }

        if (currentValue && typeof currentValue === "object" && Object.prototype.hasOwnProperty.call(currentValue, sourceKey)) {
            const relation = currentValue[sourceKey];
            delete currentValue[sourceKey];
            if (!Object.prototype.hasOwnProperty.call(currentValue, targetKey)) {
                currentValue[targetKey] = relation;
            }
        }
    }

    function setRelationKeys(node, fieldName, keys, defaultRelationValue) {
        if (!node || !fieldName) {
            return;
        }

        const normalizedKeys = uniqueKeys((keys || []).map(item => String(item || "").trim()).filter(Boolean));
        const currentValue = node[fieldName];

        if (Array.isArray(currentValue)) {
            node[fieldName] = normalizedKeys;
            return;
        }

        const currentMap = currentValue && typeof currentValue === "object" ? currentValue : {};
        const nextMap = {};

        normalizedKeys.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(currentMap, key)) {
                nextMap[key] = currentMap[key];
            } else {
                nextMap[key] = defaultRelationValue;
            }
        });

        node[fieldName] = nextMap;
    }

    function findRootsFromDag(dag) {
        const nodeKeys = Object.keys(dag);
        const rootsByParents = nodeKeys.filter(nodeKey => {
            const node = dag[nodeKey] || {};
            return getRelationKeys(node.parents).length === 0;
        });
        if (rootsByParents.length) {
            return rootsByParents;
        }

        const allNodes = new Set(nodeKeys);
        nodeKeys.forEach(nodeKey => {
            const kidKeys = getRelationKeys((dag[nodeKey] || {}).kids);
            kidKeys.forEach(kidKey => {
                allNodes.delete(kidKey);
            });
        });

        const inferredRoots = Array.from(allNodes);
        return inferredRoots.length ? inferredRoots : nodeKeys;
    }

    function ensureReferencedNodesExist(dag) {
        const defaultRelationValue = GraphApp.state && GraphApp.state.constants
            ? GraphApp.state.constants.defaultRelationValue
            : "related_to";

        Object.keys(dag).forEach(nodeKey => {
            if (!dag[nodeKey] || typeof dag[nodeKey] !== "object") {
                dag[nodeKey] = { key: nodeKey, kids: {}, parents: {} };
                return;
            }

            const node = dag[nodeKey];
            node.key = nodeKey;
            node.kids = normalizeRelationField(node.kids);
            node.parents = normalizeRelationField(node.parents);
        });

        Object.keys(dag).forEach(nodeKey => {
            const node = dag[nodeKey];
            const kids = getRelationKeys(node.kids);
            const parents = getRelationKeys(node.parents);

            kids.forEach(kidKey => {
                if (!dag[kidKey]) {
                    dag[kidKey] = { key: kidKey, kids: {}, parents: {} };
                }
                addRelationKey(dag[kidKey], "parents", nodeKey, defaultRelationValue);
            });

            parents.forEach(parentKey => {
                if (!dag[parentKey]) {
                    dag[parentKey] = { key: parentKey, kids: {}, parents: {} };
                }
                addRelationKey(dag[parentKey], "kids", nodeKey, defaultRelationValue);
            });
        });
    }

    GraphApp.normalize = {
        normalizeDagInput,
        normalizeRelationField,
        findRootsFromDag,
        ensureReferencedNodesExist,
        getRelationKeys,
        hasRelationKey,
        addRelationKey,
        removeRelationKey,
        renameRelationKey,
        setRelationKeys,
        uniqueKeys,
    };
})();
