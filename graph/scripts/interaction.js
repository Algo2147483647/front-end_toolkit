(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});
    const EXPORT_STYLE_PROPERTIES = [
        "display",
        "visibility",
        "opacity",
        "fill",
        "fill-opacity",
        "stroke",
        "stroke-opacity",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "stroke-dashoffset",
        "paint-order",
        "vector-effect",
        "filter",
        "font-family",
        "font-size",
        "font-style",
        "font-weight",
        "letter-spacing",
        "text-anchor",
        "dominant-baseline",
        "transform",
        "transform-origin",
        "transform-box",
        "pointer-events",
    ];
    const EXPORT_OPTIONAL_NONE_PROPERTIES = new Set([
        "filter",
        "transform",
        "stroke-dasharray",
        "paint-order",
        "vector-effect",
    ]);
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
    const relationEditorState = {
        isOpen: false,
        nodeKey: null,
        fieldName: null,
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
        updateModeButtons();
        updateZoomControls();
        stateModule.data.isInitialized = true;
        loadDefaultDag();
    }

    function bindEvents() {
        const dom = GraphApp.state.getDom();

        if (dom.fileInput) {
            dom.fileInput.addEventListener("change", handleFileInput);
        }
        if (dom.settingsButton) {
            dom.settingsButton.addEventListener("click", toggleSettingsPanel);
        }
        if (dom.previewModeButton) {
            dom.previewModeButton.addEventListener("click", () => setViewMode("preview"));
        }
        if (dom.editModeButton) {
            dom.editModeButton.addEventListener("click", () => setViewMode("edit"));
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
        if (dom.saveJsonButton) {
            dom.saveJsonButton.addEventListener("click", saveCurrentJson);
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
            dom.mainContent.addEventListener("scroll", hideContextMenu);
        }
        if (dom.contextMenu) {
            dom.contextMenu.addEventListener("click", handleContextMenuClick);
        }
        if (dom.relationEditorSaveButton) {
            dom.relationEditorSaveButton.addEventListener("click", saveRelationEditor);
        }
        if (dom.relationEditorCancelButton) {
            dom.relationEditorCancelButton.addEventListener("click", closeRelationEditor);
        }
        if (dom.relationEditorModal) {
            dom.relationEditorModal.addEventListener("click", event => {
                if (event.target === dom.relationEditorModal) {
                    closeRelationEditor();
                }
            });
        }

        document.addEventListener("mousemove", handlePanMove);
        document.addEventListener("mouseup", handlePanEnd);
        document.addEventListener("click", handleDocumentClick);
        document.addEventListener("keydown", handleDocumentKeydown);
        window.addEventListener("blur", stopGraphPan);
        window.addEventListener("resize", handleWindowResize);
    }

    async function loadDefaultDag() {
        const defaultFileName = "example.json";
        updateFileInputText(defaultFileName);

        try {
            const response = await fetch(defaultFileName, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Failed to load ${defaultFileName} (${response.status}).`);
            }

            const payload = await response.json();
            loadDagData(payload, { sourceFileName: defaultFileName });
        } catch (error) {
            GraphApp.svgRender.clearStage();
            setGraphMessage("Unable to load example.json automatically. Please choose a JSON file.");
            const { emptyStateMessage, emptyState } = GraphApp.state.getDom();
            if (emptyStateMessage) {
                emptyStateMessage.textContent = "Unable to load example.json automatically. Please choose a JSON file.";
            }
            if (emptyState) {
                emptyState.classList.remove("is-hidden");
            }
            console.error(error);
        }
    }

    function loadDagData(input, options) {
        const { data, resetGraphData } = GraphApp.state;
        const request = options || {};

        data.sourceFileName = request.sourceFileName || data.sourceFileName || "graph.json";
        data.normalizedDag = GraphApp.normalize.normalizeDagInput(input);
        GraphApp.normalize.ensureReferencedNodesExist(data.normalizedDag);
        syncRawDataFromNormalized();
        resetGraphData();

        const initialRoot = resolveInitialRoot(data.normalizedDag);
        renderFromRoot(initialRoot, false);
    }

    function syncRawDataFromNormalized() {
        const data = GraphApp.state.data;
        data.rawData = buildSerializableDag(data.normalizedDag || {});
    }

    function buildSerializableDag(dag) {
        const clone = {};

        Object.entries(dag || {}).forEach(([key, value]) => {
            if (!value || typeof value !== "object") {
                return;
            }

            const nodeValue = GraphApp.state.utils.structuredCloneValue(value);
            if (nodeValue.key === key) {
                delete nodeValue.key;
            }
            clone[key] = nodeValue;
        });

        return clone;
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

    function commitDagUpdate(preferredRoot, statusMessage) {
        const data = GraphApp.state.data;
        GraphApp.normalize.ensureReferencedNodesExist(data.normalizedDag);
        syncRawDataFromNormalized();

        const fallbackRoot = resolveInitialRoot(data.normalizedDag);
        const nextRoot = preferredRoot && data.normalizedDag[preferredRoot]
            ? preferredRoot
            : (data.currentRoot && data.normalizedDag[data.currentRoot] ? data.currentRoot : fallbackRoot);

        renderFromRoot(nextRoot, false);
        if (statusMessage) {
            setGraphMessage(statusMessage);
        }
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
        const exportSvgNode = buildExportSvg(svg);
        const svgData = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(exportSvgNode)}`;
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = GraphApp.state.constants.defaultExportFileName;
        downloadLink.click();
        URL.revokeObjectURL(url);
    }

    function saveCurrentJson() {
        const data = GraphApp.state.data;
        if (!data.normalizedDag) {
            setGraphMessage("Load or render a graph before saving JSON.");
            return;
        }

        const sourceFileName = data.sourceFileName || "graph.json";
        const saveAsNew = window.confirm("Save as a new file? Click OK for New (default) or Cancel for Overwrite.");
        const outputFileName = saveAsNew
            ? buildTimestampFileName(sourceFileName)
            : ensureJsonExtension(sourceFileName);

        syncRawDataFromNormalized();
        const content = JSON.stringify(data.rawData || {}, null, 2);
        downloadJsonFile(content, outputFileName);
        setGraphMessage(`Saved JSON as ${outputFileName}.`);
    }

    function downloadJsonFile(content, fileName) {
        const blob = new Blob([content], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    function ensureJsonExtension(fileName) {
        const name = String(fileName || "graph").trim() || "graph";
        return /\.json$/i.test(name) ? name : `${name}.json`;
    }

    function buildTimestampFileName(fileName) {
        const normalizedName = ensureJsonExtension(fileName || "graph.json");
        const match = normalizedName.match(/^(.*?)(\.json)$/i);
        const baseName = match ? match[1] : normalizedName;
        const extension = match ? match[2] : ".json";
        return `${baseName}-${formatTimestamp(new Date())}${extension}`;
    }

    function formatTimestamp(date) {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");
        const second = String(date.getSeconds()).padStart(2, "0");
        return `${year}${month}${day}-${hour}${minute}${second}`;
    }

    function buildExportSvg(sourceSvg) {
        const clone = sourceSvg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
        clone.setAttribute("version", "1.1");
        clone.removeAttribute("style");
        clone.removeAttribute("data-zoom-scale");
        clone.removeAttribute("data-margin-left");
        clone.removeAttribute("data-margin-top");

        copyInlineSvgStyles(sourceSvg, clone);
        normalizeExportMarkerColor(sourceSvg, clone);
        return clone;
    }

    function copyInlineSvgStyles(sourceSvg, cloneSvg) {
        const sourceElements = [sourceSvg, ...sourceSvg.querySelectorAll("*")];
        const cloneElements = [cloneSvg, ...cloneSvg.querySelectorAll("*")];

        sourceElements.forEach((sourceElement, index) => {
            const cloneElement = cloneElements[index];
            if (!cloneElement) {
                return;
            }

            const computedStyle = window.getComputedStyle(sourceElement);
            const inlineStyle = EXPORT_STYLE_PROPERTIES
                .map(propertyName => {
                    const propertyValue = computedStyle.getPropertyValue(propertyName);
                    if (!propertyValue) {
                        return "";
                    }

                    const trimmedValue = propertyValue.trim();
                    if (!trimmedValue || trimmedValue === "normal") {
                        return "";
                    }

                    if (trimmedValue === "none" && EXPORT_OPTIONAL_NONE_PROPERTIES.has(propertyName)) {
                        return "";
                    }

                    if (propertyName === "filter" && /^url\(/i.test(trimmedValue)) {
                        return "";
                    }

                    return `${propertyName}: ${trimmedValue};`;
                })
                .filter(Boolean)
                .join(" ");

            if (inlineStyle) {
                cloneElement.setAttribute("style", inlineStyle);
            } else {
                cloneElement.removeAttribute("style");
            }
        });
    }

    function normalizeExportMarkerColor(sourceSvg, cloneSvg) {
        const firstEdge = sourceSvg.querySelector(".graph-edge");
        const edgeStroke = firstEdge ? window.getComputedStyle(firstEdge).stroke.trim() : "";
        if (!edgeStroke) {
            return;
        }

        cloneSvg.querySelectorAll("marker path").forEach(path => {
            if (path.getAttribute("fill") === "context-stroke") {
                path.setAttribute("fill", edgeStroke);
                path.style.setProperty("fill", edgeStroke);
            }
        });
    }

    function setViewMode(mode) {
        GraphApp.state.data.viewMode = mode === "edit" ? "edit" : "preview";
        updateModeButtons();
        hideContextMenu();
        stopGraphPan();

        const stageData = GraphApp.state.data.stageData;
        if (stageData) {
            const focusLabel = getDisplayLabel(stageData.root, stageData.dag[stageData.root]);
            setGraphMessage(`Mode: ${GraphApp.state.data.viewMode === "edit" ? "Edit" : "Preview"}. Focused on ${focusLabel}.`);
        }
    }

    function updateModeButtons() {
        const { previewModeButton, editModeButton } = GraphApp.state.getDom();
        const isEditMode = GraphApp.state.data.viewMode === "edit";

        if (previewModeButton) {
            previewModeButton.classList.toggle("is-active", !isEditMode);
            previewModeButton.setAttribute("aria-pressed", String(!isEditMode));
        }
        if (editModeButton) {
            editModeButton.classList.toggle("is-active", isEditMode);
            editModeButton.setAttribute("aria-pressed", String(isEditMode));
        }
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
        const modeLabel = GraphApp.state.data.viewMode === "edit" ? "Edit" : "Preview";

        if (dom.graphSummary) {
            dom.graphSummary.textContent = `${modeLabel} mode. Focused on ${focusLabel}. ${nodeCount} nodes and ${edgeCount} links are visible.`;
        }
        if (dom.backButton) {
            dom.backButton.disabled = GraphApp.state.data.history.length === 0;
        }
        if (dom.emptyStateMessage) {
            dom.emptyStateMessage.textContent = "Loading graph data...";
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
                loadDagData(JSON.parse(loadEvent.target.result), { sourceFileName: file.name });
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
        const dom = GraphApp.state.getDom();
        const target = event.target;

        if (dom.controls && !dom.controls.contains(target)) {
            setSettingsPanelVisibility(false);
        }

        if (dom.contextMenu && !dom.contextMenu.contains(target)) {
            hideContextMenu();
        }
    }

    function handleDocumentKeydown(event) {
        if (event.key === "Escape") {
            setSettingsPanelVisibility(false);
            hideContextMenu();
            closeRelationEditor();
        }
    }

    function handleWindowResize() {
        refreshGraphZoom(true);
        hideContextMenu();
    }

    function handlePanStart(event) {
        const { mainContent } = GraphApp.state.getDom();
        const isEditMode = GraphApp.state.data.viewMode === "edit";
        if (!mainContent || event.button !== 2 || !mainContent.classList.contains("is-ready") || isEditMode) {
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
        if (!mainContent || !mainContent.classList.contains("is-ready")) {
            return;
        }

        event.preventDefault();

        if (GraphApp.state.data.viewMode !== "edit") {
            hideContextMenu();
            return;
        }

        const node = getNodeElement(event.target);
        const nodeKey = node ? node.dataset.nodeKey : null;
        openContextMenu(event.clientX, event.clientY, nodeKey || null);
    }

    function openContextMenu(x, y, nodeKey) {
        const { contextMenu } = GraphApp.state.getDom();
        if (!contextMenu) {
            return;
        }

        GraphApp.state.data.contextMenuNodeKey = nodeKey || null;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        contextMenu.classList.add("is-visible");
        contextMenu.setAttribute("aria-hidden", "false");

        const menuRect = contextMenu.getBoundingClientRect();
        const safeX = Math.min(x, viewportWidth - menuRect.width - 8);
        const safeY = Math.min(y, viewportHeight - menuRect.height - 8);

        contextMenu.style.left = `${Math.max(8, safeX)}px`;
        contextMenu.style.top = `${Math.max(8, safeY)}px`;

        const requiresNode = ["rename-node", "delete-node", "edit-parents", "edit-kids"];
        contextMenu.querySelectorAll(".context-menu-item").forEach(button => {
            const action = button.getAttribute("data-action") || "";
            const disabled = requiresNode.includes(action) && !nodeKey;
            button.disabled = disabled;
            button.style.opacity = disabled ? "0.45" : "1";
        });
    }

    function hideContextMenu() {
        const { contextMenu } = GraphApp.state.getDom();
        if (!contextMenu) {
            return;
        }

        contextMenu.classList.remove("is-visible");
        contextMenu.setAttribute("aria-hidden", "true");
        GraphApp.state.data.contextMenuNodeKey = null;
    }

    function handleContextMenuClick(event) {
        const target = event.target instanceof Element ? event.target.closest(".context-menu-item") : null;
        if (!target) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const action = target.getAttribute("data-action");
        const nodeKey = GraphApp.state.data.contextMenuNodeKey;
        hideContextMenu();

        if (!action) {
            return;
        }

        if (action === "rename-node" && nodeKey) {
            promptRenameNodeKey(nodeKey);
            return;
        }
        if (action === "delete-node" && nodeKey) {
            deleteNode(nodeKey);
            return;
        }
        if (action === "edit-parents" && nodeKey) {
            openRelationEditor(nodeKey, "parents");
            return;
        }
        if (action === "edit-kids" && nodeKey) {
            openRelationEditor(nodeKey, "kids");
            return;
        }
        if (action === "add-node") {
            addNode(nodeKey || null);
        }
    }

    function promptRenameNodeKey(nodeKey) {
        const dag = GraphApp.state.data.normalizedDag;
        if (!dag || !dag[nodeKey]) {
            return;
        }

        const input = window.prompt("Enter a new unique node key:", nodeKey);
        if (input === null) {
            return;
        }

        const nextKey = String(input || "").trim();
        if (!nextKey) {
            window.alert("Node key cannot be empty.");
            return;
        }

        if (nextKey.includes("\n") || nextKey.includes(",")) {
            window.alert("Node key cannot contain commas or line breaks.");
            return;
        }

        if (nextKey === nodeKey) {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(dag, nextKey)) {
            window.alert(`Node key "${nextKey}" already exists.`);
            return;
        }

        renameNodeKey(nodeKey, nextKey);
    }

    function renameNodeKey(oldKey, newKey) {
        const data = GraphApp.state.data;
        const dag = data.normalizedDag;
        const nodeValue = dag[oldKey];
        if (!nodeValue) {
            return;
        }

        delete dag[oldKey];
        dag[newKey] = nodeValue;
        dag[newKey].key = newKey;

        Object.keys(dag).forEach(nodeKey => {
            GraphApp.normalize.renameRelationKey(dag[nodeKey], "parents", oldKey, newKey);
            GraphApp.normalize.renameRelationKey(dag[nodeKey], "kids", oldKey, newKey);
        });

        data.history = data.history.map(item => (item === oldKey ? newKey : item));

        const preferredRoot = data.currentRoot === oldKey ? newKey : data.currentRoot;
        commitDagUpdate(preferredRoot, `Renamed node key from ${oldKey} to ${newKey}.`);
    }

    function deleteNode(nodeKey) {
        const data = GraphApp.state.data;
        const dag = data.normalizedDag;
        if (!dag || !dag[nodeKey]) {
            return;
        }

        const totalNodes = Object.keys(dag).length;
        if (totalNodes <= 1) {
            window.alert("At least one node must remain in the graph.");
            return;
        }

        const confirmed = window.confirm(`Delete node "${nodeKey}" and remove all related parent/kid references?`);
        if (!confirmed) {
            return;
        }

        delete dag[nodeKey];

        Object.keys(dag).forEach(otherKey => {
            GraphApp.normalize.removeRelationKey(dag[otherKey], "parents", nodeKey);
            GraphApp.normalize.removeRelationKey(dag[otherKey], "kids", nodeKey);
        });

        data.history = data.history.filter(item => item !== nodeKey);

        const preferredRoot = data.currentRoot === nodeKey ? resolveInitialRoot(dag) : data.currentRoot;
        commitDagUpdate(preferredRoot, `Deleted node ${nodeKey}.`);
    }

    function addNode(referenceNodeKey) {
        const data = GraphApp.state.data;
        const dag = data.normalizedDag;
        if (!dag) {
            return;
        }

        const input = window.prompt("Enter a new unique node key:", "New_Node");
        if (input === null) {
            return;
        }

        const newKey = String(input || "").trim();
        if (!newKey) {
            window.alert("Node key cannot be empty.");
            return;
        }

        if (newKey.includes("\n") || newKey.includes(",")) {
            window.alert("Node key cannot contain commas or line breaks.");
            return;
        }

        if (Object.prototype.hasOwnProperty.call(dag, newKey)) {
            window.alert(`Node key "${newKey}" already exists.`);
            return;
        }

        dag[newKey] = {
            key: newKey,
            define: "",
            properties: [],
            parents: {},
            kids: {},
        };

        if (referenceNodeKey && dag[referenceNodeKey]) {
            const shouldLink = window.confirm(`Link "${newKey}" as a child of "${referenceNodeKey}"?`);
            if (shouldLink) {
                addKidReferences(referenceNodeKey, [newKey]);
            }
        }

        commitDagUpdate(data.currentRoot || resolveInitialRoot(dag), `Added node ${newKey}.`);
    }

    function openRelationEditor(nodeKey, fieldName) {
        const data = GraphApp.state.data;
        const dag = data.normalizedDag;
        if (!dag || !dag[nodeKey]) {
            return;
        }

        const dom = GraphApp.state.getDom();
        const relationKeys = GraphApp.normalize.getRelationKeys(dag[nodeKey][fieldName]);

        relationEditorState.isOpen = true;
        relationEditorState.nodeKey = nodeKey;
        relationEditorState.fieldName = fieldName;

        if (dom.relationEditorTitle) {
            dom.relationEditorTitle.textContent = fieldName === "parents" ? "Edit Parents" : "Edit Kids";
        }
        if (dom.relationEditorDescription) {
            dom.relationEditorDescription.textContent = `Editing ${fieldName} for node ${nodeKey}.`;
        }
        if (dom.relationEditorInput) {
            dom.relationEditorInput.value = relationKeys.join("\n");
        }
        if (dom.relationEditorModal) {
            dom.relationEditorModal.classList.add("is-visible");
            dom.relationEditorModal.setAttribute("aria-hidden", "false");
        }

        setTimeout(() => {
            if (dom.relationEditorInput) {
                dom.relationEditorInput.focus();
                dom.relationEditorInput.setSelectionRange(0, dom.relationEditorInput.value.length);
            }
        }, 0);
    }

    function closeRelationEditor() {
        if (!relationEditorState.isOpen) {
            return;
        }

        relationEditorState.isOpen = false;
        relationEditorState.nodeKey = null;
        relationEditorState.fieldName = null;

        const { relationEditorModal } = GraphApp.state.getDom();
        if (relationEditorModal) {
            relationEditorModal.classList.remove("is-visible");
            relationEditorModal.setAttribute("aria-hidden", "true");
        }
    }

    function saveRelationEditor() {
        const nodeKey = relationEditorState.nodeKey;
        const fieldName = relationEditorState.fieldName;
        const { relationEditorInput } = GraphApp.state.getDom();
        if (!relationEditorState.isOpen || !nodeKey || !fieldName || !relationEditorInput) {
            return;
        }

        const nextKeys = parseRelationInput(relationEditorInput.value);
        if (nextKeys.includes(nodeKey)) {
            window.alert("A node cannot reference itself.");
            return;
        }

        if (fieldName === "parents") {
            setParentReferences(nodeKey, nextKeys);
        } else {
            setKidReferences(nodeKey, nextKeys);
        }

        closeRelationEditor();
        commitDagUpdate(GraphApp.state.data.currentRoot, `Updated ${fieldName} for ${nodeKey}.`);
    }

    function parseRelationInput(rawText) {
        const keys = String(rawText || "")
            .split(/[\n,]/)
            .map(item => item.trim())
            .filter(Boolean);

        return GraphApp.normalize.uniqueKeys(keys);
    }

    function ensureNodeExists(nodeKey) {
        const dag = GraphApp.state.data.normalizedDag;
        if (!dag[nodeKey]) {
            dag[nodeKey] = {
                key: nodeKey,
                define: "",
                properties: [],
                parents: {},
                kids: {},
            };
        }
    }

    function setParentReferences(nodeKey, parentKeys) {
        const dag = GraphApp.state.data.normalizedDag;
        ensureNodeExists(nodeKey);

        const node = dag[nodeKey];
        const previousParents = GraphApp.normalize.getRelationKeys(node.parents);
        const nextParents = GraphApp.normalize.uniqueKeys(parentKeys);

        GraphApp.normalize.setRelationKeys(node, "parents", nextParents, GraphApp.state.constants.defaultRelationValue);

        previousParents.forEach(parentKey => {
            if (!nextParents.includes(parentKey) && dag[parentKey]) {
                GraphApp.normalize.removeRelationKey(dag[parentKey], "kids", nodeKey);
            }
        });

        nextParents.forEach(parentKey => {
            ensureNodeExists(parentKey);
            GraphApp.normalize.addRelationKey(
                dag[parentKey],
                "kids",
                nodeKey,
                GraphApp.state.constants.defaultRelationValue
            );
        });
    }

    function setKidReferences(nodeKey, kidKeys) {
        const dag = GraphApp.state.data.normalizedDag;
        ensureNodeExists(nodeKey);

        const node = dag[nodeKey];
        const previousKids = GraphApp.normalize.getRelationKeys(node.kids);
        const nextKids = GraphApp.normalize.uniqueKeys(kidKeys);

        GraphApp.normalize.setRelationKeys(node, "kids", nextKids, GraphApp.state.constants.defaultRelationValue);

        previousKids.forEach(kidKey => {
            if (!nextKids.includes(kidKey) && dag[kidKey]) {
                GraphApp.normalize.removeRelationKey(dag[kidKey], "parents", nodeKey);
            }
        });

        nextKids.forEach(kidKey => {
            ensureNodeExists(kidKey);
            GraphApp.normalize.addRelationKey(
                dag[kidKey],
                "parents",
                nodeKey,
                GraphApp.state.constants.defaultRelationValue
            );
        });
    }

    function addKidReferences(parentKey, kidKeys) {
        const dag = GraphApp.state.data.normalizedDag;
        ensureNodeExists(parentKey);

        kidKeys.forEach(kidKey => {
            ensureNodeExists(kidKey);
            GraphApp.normalize.addRelationKey(
                dag[parentKey],
                "kids",
                kidKey,
                GraphApp.state.constants.defaultRelationValue
            );
            GraphApp.normalize.addRelationKey(
                dag[kidKey],
                "parents",
                parentKey,
                GraphApp.state.constants.defaultRelationValue
            );
        });
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
