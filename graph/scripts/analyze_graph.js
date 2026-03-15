function FindRootsFromDag(dag) {
    const allNodes = new Set(Object.keys(dag));

    for (const nodeName in dag) {
        const kids = dag[nodeName].kids || [];
        const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);

        kidKeys.forEach(kid => {
            allNodes.delete(kid);
        });
    }

    return Array.from(allNodes);
}

function BuildCoordinateForDag(dag, root) {
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
                    dag[kidKey] = { kids: [] };
                }

                if (!visited.has(kidKey)) {
                    visited.add(kidKey);
                    queue.push(kidKey);
                }
            });
        }
    }

    return dag;
}
