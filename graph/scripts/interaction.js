(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});
    const panState = {
        isActive: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
    };
    const interactionState = {
        hoveredNodeKey: null,
        focusedNodeKey: null,
    };

    function init() {
        const stateModule = GraphApp.state;
        if (!stateModule || !GraphApp.normalize || !GraphApp.layout || !GraphApp.svgRender) {
            throw new Error("GraphApp modules are not fully initialized.");
        }

        if (stateModule.data.isInitialized) {
            return;
        }

        bindEvents();
        updateZoomControls();
        stateModule.data.isInitialized = true;
    }

    function bindEvents() {
        const dom = GraphApp.state.getDom();

        if (dom.fileInput) {
            dom.fileInput.addEventListener("change", handleFileInput);
        }
        if (dom.settingsButton) {
            dom.settingsButton.addEventListener("click", toggleSettingsPanel);
        }
        if (dom.zoomInButton) {
            dom.zoomInButton.addEventListener("click", zoomGraphIn);
        }
        if (dom.zoomOutButton) {
            dom.zoomOutButton.addEventListener("click", zoomGraphOut);
        }
        if (dom.zoomFitButton) {
            dom.zoomFitButton.addEventListener("click", fitGraphToViewport);
        }
        if (dom.zoomValueInput) {
            dom.zoomValueInput.addEventListener("change", commitZoomValueInput);
            dom.zoomValueInput.addEventListener("blur", commitZoomValueInput);
            dom.zoomValueInput.addEventListener("keydown", handleZoomValueKeydown);
        }
        if (dom.exportButton) {
            dom.exportButton.addEventListener("click", exportCurrentSvg);
        }
        if (dom.backButton) {
            dom.backButton.addEventListener("click", navigateBack);
        }
        if (dom.mainContent) {
            dom.mainContent.addEventListener("mousedown", handlePanStart);
            dom.mainContent.addEventListener("contextmenu", handleGraphContextMenu);
            dom.mainContent.addEventListener("mouseover", handleNodeMouseOver);
            dom.mainContent.addEventListener("mouseout", handleNodeMouseOut);
            dom.mainContent.addEventListener("focusin", handleNodeFocusIn);
            dom.mainContent.addEventListener("focusout", handleNodeFocusOut);
            dom.mainContent.addEventListener("keydown", handleNodeKeydown);
            dom.mainContent.addEventListener("click", handleNodeClick);
        }

        document.addEventListener("mousemove", handlePanMove);
        document.addEventListener("mouseup", handlePanEnd);
        document.addEventListener("click", handleDocumentClick);
        document.addEventListener("keydown", handleDocumentKeydown);
        window.addEventListener("blur", stopGraphPan);
        window.addEventListener("resize", handleWindowResize);
    }

    function loadDagData(input) {
        const { data, resetGraphData } = GraphApp.state;
        data.rawData = input;
        data.normalizedDag = GraphApp.normalize.normalizeDagInput(input);
        resetGraphData();

        const initialRoot = resolveInitialRoot(data.normalizedDag);
        renderFromRoot(initialRoot, false);
    }

    function navigateBack() {
        const previousRoot = GraphApp.state.data.history.pop();
        if (!previousRoot) {
            return;
        }

        renderFromRoot(previousRoot, false);
    }

    function renderFromRoot(rootKey, pushHistory) {
        const data = GraphApp.state.data;
        if (!data.normalizedDag) {
            return;
        }

        if (pushHistory && data.currentRoot && data.currentRoot !== rootKey) {
            data.history.push(data.currentRoot);
        }

        const stageData = GraphApp.layout.buildStageData(data.normalizedDag, rootKey);
        if (!stageData) {
            return;
        }

        data.currentRoot = stageData.root;
        data.stageData = stageData;
        interactionState.hoveredNodeKey = null;
        interactionState.focusedNodeKey = null;

        GraphApp.svgRender.renderStage(stageData);
        updateChrome(stageData);
        refreshGraphZoom(false);
    }

    function setGraphMessage(message) {
        const { graphSummary } = GraphApp.state.getDom();
        if (graphSummary) {
            graphSummary.textContent = message;
        }
    }

    function exportCurrentSvg() {
        const svg = GraphApp.svgRender.getRenderedSvg();
        if (!svg) {
            setGraphMessage("Render a DAG first, then export the SVG.");
            return;
        }

        exportSvg(svg);
    }

    function exportSvg(svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = GraphApp.state.constants.defaultExportFileName;
        downloadLink.click();
        URL.revokeObjectURL(url);
    }

    function zoomGraphIn() {
        setGraphZoom(GraphApp.state.data.zoomScale + GraphApp.state.constants.zoomStep, true);
    }

    function zoomGraphOut() {
        setGraphZoom(GraphApp.state.data.zoomScale - GraphApp.state.constants.zoomStep, true);
    }

    function fitGraphToViewport() {
        setGraphZoom(GraphApp.state.data.minZoomScale, false);
    }

    function setGraphZoomPercent(percent, preserveCenter) {
        const parsedPercent = Number(percent);
        if (!Number.isFinite(parsedPercent) || parsedPercent <= 0) {
            updateZoomControls();
            return false;
        }

        setGraphZoom(parsedPercent / 100, preserveCenter !== false);
        return true;
    }

    function refreshGraphZoom(preserveCenter) {
        const { mainContent } = GraphApp.state.getDom();
        const svg = GraphApp.svgRender.getRenderedSvg();
        const data = GraphApp.state.data;

        if (!mainContent || !svg || !data.stageData) {
            updateZoomControls();
            return;
        }

        const previousMinZoomScale = data.minZoomScale;
        const fitScale = getFitZoomScale(mainContent, data.stageData);
        data.minZoomScale = fitScale;

        if (Math.abs(data.zoomScale - previousMinZoomScale) < 0.001) {
            data.zoomScale = fitScale;
        } else {
            data.zoomScale = GraphApp.state.utils.clamp(data.zoomScale, data.minZoomScale, data.maxZoomScale);
        }

        applyGraphZoom(mainContent, svg, data.stageData, data.zoomScale, Boolean(preserveCenter));
        updateZoomControls();
    }

    function setGraphZoom(nextScale, preserveCenter) {
        const { mainContent } = GraphApp.state.getDom();
        const svg = GraphApp.svgRender.getRenderedSvg();
        const data = GraphApp.state.data;

        if (!mainContent || !svg || !data.stageData) {
            return;
        }

        data.zoomScale = GraphApp.state.utils.clamp(nextScale, data.minZoomScale, data.maxZoomScale);
        applyGraphZoom(mainContent, svg, data.stageData, data.zoomScale, Boolean(preserveCenter));
        updateZoomControls();
    }

    function getFitZoomScale(container, stageData) {
        const viewportMetrics = getViewportMetrics(container);
        const availableWidth = Math.max(viewportMetrics.availableWidth, 1);
        const availableHeight = Math.max(viewportMetrics.availableHeight, 1);
        const fitScale = Math.min(availableWidth / stageData.stageWidth, availableHeight / stageData.stageHeight, 1);
        return Math.max(fitScale, GraphApp.state.constants.minZoomFloor);
    }

    function applyGraphZoom(container, svg, stageData, scale, preserveCenter) {
        const previousScale = Number(svg.dataset.zoomScale || 1);
        const previousMarginLeft = Number(svg.dataset.marginLeft || 0);
        const previousMarginTop = Number(svg.dataset.marginTop || 0);
        const viewportMetrics = getViewportMetrics(container);
        const scaledWidth = stageData.stageWidth * scale;
        const scaledHeight = stageData.stageHeight * scale;
        const marginLeft = Math.max((viewportMetrics.availableWidth - scaledWidth) / 2, 0);
        const marginTop = viewportMetrics.safeTop + Math.max((viewportMetrics.availableHeight - scaledHeight) / 2, 0);
        const centerX = preserveCenter
            ? (container.scrollLeft + container.clientWidth / 2 - previousMarginLeft) / previousScale
            : stageData.stageWidth / 2;
        const centerY = preserveCenter
            ? (container.scrollTop + container.clientHeight / 2 - previousMarginTop) / previousScale
            : stageData.stageHeight / 2;

        svg.style.width = `${scaledWidth}px`;
        svg.style.height = `${scaledHeight}px`;
        svg.style.marginLeft = `${marginLeft}px`;
        svg.style.marginTop = `${marginTop}px`;
        svg.dataset.zoomScale = String(scale);
        svg.dataset.marginLeft = String(marginLeft);
        svg.dataset.marginTop = String(marginTop);

        container.scrollLeft = Math.max(centerX * scale + marginLeft - container.clientWidth / 2, 0);
        container.scrollTop = Math.max(centerY * scale + marginTop - container.clientHeight / 2, 0);
    }

    function getViewportMetrics(container) {
        const { topbar } = GraphApp.state.getDom();
        const containerRect = container.getBoundingClientRect();
        const topbarRect = topbar ? topbar.getBoundingClientRect() : null;
        const safeTop = topbarRect ? Math.max(topbarRect.bottom - containerRect.top + 12, 0) : 0;
        const horizontalInset = 24;
        const bottomInset = 16;

        return {
            safeTop,
            availableWidth: container.clientWidth - horizontalInset * 2,
            availableHeight: container.clientHeight - safeTop - bottomInset,
        };
    }

    function updateZoomControls() {
        const dom = GraphApp.state.getDom();
        const { stageData, zoomScale, minZoomScale, maxZoomScale } = GraphApp.state.data;
        const hasGraph = Boolean(stageData);
        const roundedPercent = Math.round(zoomScale * 100);

        if (dom.zoomValueInput) {
            dom.zoomValueInput.value = String(roundedPercent);
            dom.zoomValueInput.disabled = !hasGraph;
        }
        if (dom.zoomInButton) {
            dom.zoomInButton.disabled = !hasGraph || zoomScale >= maxZoomScale - 0.001;
        }
        if (dom.zoomOutButton) {
            dom.zoomOutButton.disabled = !hasGraph || zoomScale <= minZoomScale + 0.001;
        }
        if (dom.zoomFitButton) {
            dom.zoomFitButton.disabled = !hasGraph || Math.abs(zoomScale - minZoomScale) < 0.001;
        }
    }

    function updateChrome(stageData) {
        const dom = GraphApp.state.getDom();
        const edgeCount = stageData.edges.length;
        const nodeCount = stageData.nodes.length;
        const focusLabel = getDisplayLabel(stageData.root, stageData.dag[stageData.root]);

        if (dom.graphSummary) {
            dom.graphSummary.textContent = `Focused on ${focusLabel}. ${nodeCount} nodes and ${edgeCount} links are visible in this branch map.`;
        }
        if (dom.backButton) {
            dom.backButton.disabled = GraphApp.state.data.history.length === 0;
        }
        if (dom.emptyStateMessage) {
            dom.emptyStateMessage.textContent = "Import a JSON file to render a focused DAG view with drill-down navigation.";
        }
    }

    function resolveInitialRoot(dag) {
        const roots = GraphApp.normalize.findRootsFromDag(dag);
        if (roots.length === 1) {
            return roots[0];
        }
        if (dag.root) {
            return "root";
        }
        return "__graph_root__";
    }

    function getDisplayLabel(nodeKey, node) {
        if (node && node.synthetic && nodeKey === "__graph_root__") {
            return "All roots";
        }

        return GraphApp.state.utils.sanitizeNodeLabel((node && (node.label || node.title || node.name || nodeKey)) || nodeKey);
    }

    function handleFileInput(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        updateFileInputText(file.name);

        const reader = new FileReader();
        reader.onload = loadEvent => {
            try {
                loadDagData(JSON.parse(loadEvent.target.result));
            } catch (error) {
                setGraphMessage("The selected file could not be parsed as JSON.");
                const { emptyStateMessage } = GraphApp.state.getDom();
                if (emptyStateMessage) {
                    emptyStateMessage.textContent = "The selected file could not be parsed as JSON.";
                }
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    function updateFileInputText(fileName) {
        const { fileInputText } = GraphApp.state.getDom();
        if (fileInputText) {
            fileInputText.textContent = fileName.length > 26 ? `${fileName.slice(0, 23)}...` : fileName;
        }
    }

    function handleZoomValueKeydown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            commitZoomValueInput();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            updateZoomControls();
            event.currentTarget.blur();
        }
    }

    function commitZoomValueInput() {
        const { zoomValueInput } = GraphApp.state.getDom();
        if (zoomValueInput) {
            setGraphZoomPercent(zoomValueInput.value, true);
        }
    }

    function toggleSettingsPanel() {
        const { settingsPanel } = GraphApp.state.getDom();
        if (!settingsPanel) {
            return;
        }

        setSettingsPanelVisibility(!settingsPanel.classList.contains("settings-panel-visible"));
    }

    function setSettingsPanelVisibility(isVisible) {
        const { settingsButton, settingsPanel } = GraphApp.state.getDom();
        if (!settingsButton || !settingsPanel) {
            return;
        }

        settingsPanel.classList.toggle("settings-panel-visible", isVisible);
        settingsButton.setAttribute("aria-expanded", String(isVisible));
    }

    function handleDocumentClick(event) {
        const { controls } = GraphApp.state.getDom();
        if (!controls || controls.contains(event.target)) {
            return;
        }

        setSettingsPanelVisibility(false);
    }

    function handleDocumentKeydown(event) {
        if (event.key === "Escape") {
            setSettingsPanelVisibility(false);
        }
    }

    function handleWindowResize() {
        refreshGraphZoom(true);
    }

    function handlePanStart(event) {
        const { mainContent } = GraphApp.state.getDom();
        if (!mainContent || event.button !== 2 || !mainContent.classList.contains("is-ready")) {
            return;
        }

        event.preventDefault();
        panState.isActive = true;
        panState.startX = event.clientX;
        panState.startY = event.clientY;
        panState.scrollLeft = mainContent.scrollLeft;
        panState.scrollTop = mainContent.scrollTop;
        document.body.classList.add("graph-is-panning");
    }

    function handlePanMove(event) {
        const { mainContent } = GraphApp.state.getDom();
        if (!panState.isActive || !mainContent) {
            return;
        }

        const deltaX = event.clientX - panState.startX;
        const deltaY = event.clientY - panState.startY;
        mainContent.scrollLeft = panState.scrollLeft - deltaX;
        mainContent.scrollTop = panState.scrollTop - deltaY;
    }

    function handlePanEnd(event) {
        if (event.button === 2) {
            stopGraphPan();
        }
    }

    function stopGraphPan() {
        if (!panState.isActive) {
            return;
        }

        panState.isActive = false;
        document.body.classList.remove("graph-is-panning");
    }

    function handleGraphContextMenu(event) {
        const { mainContent } = GraphApp.state.getDom();
        if (mainContent && mainContent.classList.contains("is-ready")) {
            event.preventDefault();
        }
    }

    function handleNodeMouseOver(event) {
        const node = getNodeElement(event.target);
        if (!node || node === getNodeElement(event.relatedTarget)) {
            return;
        }

        interactionState.hoveredNodeKey = node.dataset.nodeKey || null;
        applyHoverState(resolveInteractiveNodeKey());
    }

    function handleNodeMouseOut(event) {
        const node = getNodeElement(event.target);
        if (!node || node === getNodeElement(event.relatedTarget)) {
            return;
        }

        if (interactionState.hoveredNodeKey === node.dataset.nodeKey) {
            interactionState.hoveredNodeKey = null;
        }
        applyHoverState(resolveInteractiveNodeKey());
    }

    function handleNodeFocusIn(event) {
        const node = getNodeElement(event.target);
        if (!node) {
            return;
        }

        node.classList.add("is-focused");
        interactionState.focusedNodeKey = node.dataset.nodeKey || null;
        applyHoverState(resolveInteractiveNodeKey());
    }

    function handleNodeFocusOut(event) {
        const node = getNodeElement(event.target);
        if (!node || node === getNodeElement(event.relatedTarget)) {
            return;
        }

        node.classList.remove("is-focused");
        if (interactionState.focusedNodeKey === node.dataset.nodeKey) {
            interactionState.focusedNodeKey = null;
        }
        applyHoverState(resolveInteractiveNodeKey());
    }

    function handleNodeKeydown(event) {
        const node = getNodeElement(event.target);
        if (!node) {
            return;
        }

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            focusNodeBranch(node.dataset.nodeKey);
        }
    }

    function handleNodeClick(event) {
        const node = getNodeElement(event.target);
        if (node) {
            focusNodeBranch(node.dataset.nodeKey);
        }
    }

    function focusNodeBranch(nodeKey) {
        if (!nodeKey || GraphApp.state.data.currentRoot === nodeKey) {
            return;
        }

        renderFromRoot(nodeKey, true);
    }

    function getNodeElement(target) {
        return target instanceof Element ? target.closest(".graph-node") : null;
    }

    function resolveInteractiveNodeKey() {
        return interactionState.hoveredNodeKey || interactionState.focusedNodeKey || null;
    }

    function applyHoverState(nodeKey) {
        const { mainContent } = GraphApp.state.getDom();
        if (!mainContent) {
            return;
        }

        const allNodes = mainContent.querySelectorAll(".graph-node");
        const allEdges = mainContent.querySelectorAll(".graph-edge");
        const currentRoot = GraphApp.state.data.currentRoot;

        if (!nodeKey) {
            allNodes.forEach(node => {
                node.classList.remove("is-hovered", "is-active", "is-dimmed");
                if (node.dataset.nodeKey === currentRoot) {
                    node.classList.add("is-active");
                }
            });
            allEdges.forEach(edge => {
                edge.classList.remove("is-active", "is-dimmed");
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
            const nodeValue = node.dataset.nodeKey;
            const isCurrent = nodeValue === nodeKey;
            const isConnected = connectedNodes.has(nodeValue);
            node.classList.toggle("is-hovered", isCurrent);
            node.classList.toggle("is-active", isCurrent || nodeValue === currentRoot);
            node.classList.toggle("is-dimmed", !isConnected);
        });
    }

    GraphApp.interaction = {
        init,
        loadDagData,
        navigateBack,
        setGraphMessage,
        zoomGraphIn,
        zoomGraphOut,
        fitGraphToViewport,
        setGraphZoomPercent,
        refreshGraphZoom,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
