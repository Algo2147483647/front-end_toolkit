function FindRootsFromDag(dag) {
    const allNodes = new Set(Object.keys(dag));
    for (let nodeName in dag) {
        const kids = dag[nodeName].kids;
        // Handle both array format (kids: ["B", "C"]) and object format (kids: {"B": 1, "C": 1})
        const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);
        kidKeys.forEach(kid => {
            allNodes.delete(kid);
        });
    }
    return Array.from(allNodes);
}

function BuildCoordinateForDag(dag, root) {
    const queue = [root];
    let level = -1;

    while (queue.length) {
        const n = queue.length;
        level += 1;
        for (let i = 0; i < n; i++) {
            const key = queue.shift();
            dag[key]["coordinate"] = [level, i];
            
            // Handle both array format (kids: ["B", "C"]) and object format (kids: {"B": 1, "C": 1})
            const kids = dag[key].kids;
            const kidKeys = Array.isArray(kids) ? kids : Object.keys(kids);
            
            kidKeys.forEach(kidKey => {
                if (!dag[kidKey].hasOwnProperty('coordinate')) {
                    queue.push(kidKey);
                    dag[kidKey]["coordinate"] = [-1, -1];
                }
            });
        }
    }

    return dag;
}
