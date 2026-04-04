(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});
    const SVG_NS = "http://www.w3.org/2000/svg";
    const SOURCE_EDGE_GAP = 4;
    const TARGET_EDGE_GAP = 0;
    const ARROW_MARKER_WIDTH = 10;
    const ARROW_MARKER_HEIGHT = 8;

    function renderStage(stageData) {
        const { mainContent, emptyState } = GraphApp.state.getDom();
        if (!mainContent || !stageData) {
            return null;
        }

        mainContent.replaceChildren();
        mainContent.classList.add("is-ready");
        if (emptyState) {
            emptyState.classList.add("is-hidden");
        }

        const svg = createSvgElement("svg", {
            viewBox: `0 0 ${stageData.stageWidth} ${stageData.stageHeight}`,
            width: String(stageData.stageWidth),
            height: String(stageData.stageHeight),
            role: "img",
            "aria-label": `DAG view focused on ${stageData.root}`,
        });

        svg.appendChild(buildDefs());
        svg.appendChild(buildStageBackdrop(stageData));

        const edgeLayer = createSvgElement("g", { class: "graph-edge-layer" });
        stageData.edges.forEach(edge => {
            edgeLayer.appendChild(buildEdge(stageData, edge));
        });

        const nodeLayer = createSvgElement("g", { class: "graph-node-layer" });
        stageData.nodes.forEach(node => {
            nodeLayer.appendChild(buildNode(node));
        });

        svg.appendChild(edgeLayer);
        svg.appendChild(nodeLayer);
        mainContent.appendChild(svg);
        return svg;
    }

    function getRenderedSvg() {
        const { mainContent } = GraphApp.state.getDom();
        return mainContent ? mainContent.querySelector("svg") : null;
    }

    function clearStage() {
        const { mainContent, emptyState } = GraphApp.state.getDom();
        if (mainContent) {
            mainContent.replaceChildren();
            mainContent.classList.remove("is-ready");
        }

        if (emptyState) {
            emptyState.classList.remove("is-hidden");
        }
    }

    function buildDefs() {
        const defs = createSvgElement("defs");

        const marker = createSvgElement("marker", {
            id: "arrowhead",
            viewBox: `0 0 ${ARROW_MARKER_WIDTH} ${ARROW_MARKER_HEIGHT}`,
            orient: "auto",
            markerUnits: "userSpaceOnUse",
            markerWidth: String(ARROW_MARKER_WIDTH),
            markerHeight: String(ARROW_MARKER_HEIGHT),
            refX: String(ARROW_MARKER_WIDTH - 0.4),
            refY: String(ARROW_MARKER_HEIGHT / 2),
        });
        marker.appendChild(createSvgElement("path", {
            d: `M 0 0 L ${ARROW_MARKER_WIDTH} ${ARROW_MARKER_HEIGHT / 2} L 0 ${ARROW_MARKER_HEIGHT} z`,
            fill: "context-stroke",
        }));
        defs.appendChild(marker);

        const filter = createSvgElement("filter", {
            id: "soft-glow",
            x: "-50%",
            y: "-50%",
            width: "200%",
            height: "200%",
        });
        filter.appendChild(createSvgElement("feGaussianBlur", { stdDeviation: "10" }));
        defs.appendChild(filter);

        return defs;
    }

    function buildStageBackdrop(stageData) {
        const group = createSvgElement("g", { class: "graph-stage" });
        group.appendChild(createSvgElement("rect", {
            class: "graph-stage__halo",
            x: "24",
            y: "24",
            width: String(stageData.stageWidth - 48),
            height: String(stageData.stageHeight - 48),
            rx: "28",
            ry: "28",
        }));

        stageData.lanes.forEach(lane => {
            group.appendChild(createSvgElement("line", {
                class: "graph-stage__lane",
                x1: String(lane.x),
                y1: "54",
                x2: String(lane.x),
                y2: String(stageData.stageHeight - 54),
            }));

            const label = createSvgElement("text", {
                class: "graph-stage__lane-label",
                x: String(lane.x),
                y: "42",
                "text-anchor": "middle",
            });
            label.textContent = lane.label;
            group.appendChild(label);
        });

        const rootNode = stageData.nodeMap[stageData.root];
        if (rootNode) {
            group.appendChild(createSvgElement("ellipse", {
                class: "graph-stage__focus",
                cx: String(rootNode.x),
                cy: String(rootNode.y),
                rx: String(rootNode.width * 0.9),
                ry: "92",
                filter: "url(#soft-glow)",
            }));
        }

        return group;
    }

    function buildEdge(stageData, edge) {
        const sourceNode = stageData.nodeMap[edge.source];
        const targetNode = stageData.nodeMap[edge.target];
        const startX = sourceNode.x + sourceNode.width / 2 + SOURCE_EDGE_GAP;
        const startY = sourceNode.y;
        const endX = targetNode.x - targetNode.width / 2 - TARGET_EDGE_GAP;
        const endY = targetNode.y;
        const horizontalSpan = Math.max(endX - startX, 24);
        const verticalSpan = Math.abs(endY - startY);
        const bendBase = Math.max(horizontalSpan * 0.58, Math.min(verticalSpan * 0.22, 96), 64);
        const bend = Math.min(bendBase, horizontalSpan - 12);
        const d = [
            `M ${startX} ${startY}`,
            `C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
        ].join(" ");

        const group = createSvgElement("g", { class: "graph-edge-group" });
        group.appendChild(createSvgElement("path", {
            class: "graph-edge-glow",
            d,
        }));
        group.appendChild(createSvgElement("path", {
            class: "graph-edge",
            d,
            "data-source": edge.source,
            "data-target": edge.target,
            "marker-end": "url(#arrowhead)",
        }));

        if (edge.label) {
            const labelX = (startX + endX) / 2;
            const labelY = (startY + endY) / 2 - 9;
            const labelWidth = Math.max(18, edge.label.length * 7 + 10);

            group.appendChild(createSvgElement("rect", {
                class: "graph-edge-label-bg",
                x: String(labelX - labelWidth / 2),
                y: String(labelY - 10),
                width: String(labelWidth),
                height: "16",
                rx: "8",
                ry: "8",
            }));

            const label = createSvgElement("text", {
                class: "graph-edge-label",
                x: String(labelX),
                y: String(labelY + 1),
                "text-anchor": "middle",
            });
            label.textContent = edge.label;
            group.appendChild(label);
        }

        return group;
    }

    function buildNode(nodeData) {
        const truncate = GraphApp.state.utils.truncate;
        const group = createSvgElement("g", {
            class: `graph-node${nodeData.isRoot ? " is-root is-active" : ""}`,
            "data-node-key": nodeData.key,
            transform: `translate(${nodeData.x - nodeData.width / 2}, ${nodeData.y - nodeData.height / 2})`,
            tabindex: "0",
            focusable: "true",
            role: "button",
            "aria-label": `${nodeData.title}. ${nodeData.detail}. ${nodeData.isRoot ? "Current focus." : "Activate to focus this branch."}`,
        });

        group.appendChild(createSvgElement("ellipse", {
            class: "graph-node__glow",
            cx: String(nodeData.width / 2),
            cy: String(nodeData.height / 2),
            rx: String(nodeData.width / 2 + 16),
            ry: String(nodeData.height / 2 + 10),
        }));
        group.appendChild(createSvgElement("rect", {
            class: "graph-node__shape",
            width: String(nodeData.width),
            height: String(nodeData.height),
            rx: "24",
            ry: "24",
        }));
        group.appendChild(createSvgElement("circle", {
            class: "graph-node__pin",
            cx: "26",
            cy: String(nodeData.height / 2),
            r: "11",
        }));
        group.appendChild(createSvgElement("circle", {
            class: "graph-node__pin-core",
            cx: "26",
            cy: String(nodeData.height / 2),
            r: "4",
        }));

        const title = createSvgElement("text", {
            class: "graph-node__title",
            x: "48",
            y: "29",
        });
        title.textContent = truncate(nodeData.title, 24);
        group.appendChild(title);

        const detail = createSvgElement("text", {
            class: "graph-node__detail",
            x: "48",
            y: "43",
        });
        detail.textContent = truncate(nodeData.detail, 34);
        group.appendChild(detail);

        const affordance = createSvgElement("g", { class: "graph-node__affordance" });
        affordance.appendChild(createSvgElement("rect", {
            class: "graph-node__affordance-bg",
            x: String(nodeData.width - 90),
            y: String(nodeData.height - 21),
            width: "74",
            height: "14",
            rx: "7",
            ry: "7",
        }));

        const affordanceText = createSvgElement("text", {
            class: "graph-node__affordance-text",
            x: String(nodeData.width - 53),
            y: String(nodeData.height - 10),
            "text-anchor": "middle",
        });
        affordanceText.textContent = nodeData.isRoot ? "Focused" : "Refocus";
        affordance.appendChild(affordanceText);
        group.appendChild(affordance);

        return group;
    }

    function createSvgElement(tagName, attributes) {
        const element = document.createElementNS(SVG_NS, tagName);
        if (attributes) {
            Object.entries(attributes).forEach(([name, value]) => {
                element.setAttribute(name, value);
            });
        }

        return element;
    }

    GraphApp.svgRender = {
        renderStage,
        getRenderedSvg,
        clearStage,
    };
})();
