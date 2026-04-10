(function () {
    const GraphApp = window.GraphApp || (window.GraphApp = {});

    const data = {
        rawData: null,
        normalizedDag: null,
        currentRoot: null,
        currentSelection: null,
        history: [],
        stageData: null,
        zoomScale: 1,
        minZoomScale: 1,
        maxZoomScale: 2,
        isInitialized: false,
        viewMode: "preview",
        sourceFileName: "example.json",
        contextMenuNodeKey: null,
    };

    const theme = {
        stagePaddingX: 108,
        stagePaddingY: 88,
        columnGap: 116,
        rowGap: 22,
        nodeHeight: 74,
        minNodeWidth: 188,
        maxNodeWidth: 280,
    };

    const constants = {
        zoomStep: 0.1,
        minZoomFloor: 0.05,
        defaultExportFileName: "dag-graph.svg",
        defaultRelationValue: "related_to",
    };

    let domCache = null;

    function getDom() {
        if (!domCache) {
            domCache = {
                mainContent: document.getElementById("main-content"),
                emptyState: document.getElementById("empty-state"),
                emptyStateMessage: document.getElementById("empty-state-message"),
                graphSummary: document.getElementById("graph-summary"),
                backButton: document.getElementById("back-btn"),
                upButton: document.getElementById("up-btn"),
                zoomInButton: document.getElementById("zoom-in-btn"),
                zoomOutButton: document.getElementById("zoom-out-btn"),
                zoomFitButton: document.getElementById("zoom-fit-btn"),
                zoomValueInput: document.getElementById("zoom-value-input"),
                controls: document.getElementById("floating-controls"),
                settingsButton: document.getElementById("settings-btn"),
                settingsPanel: document.getElementById("settings-panel"),
                previewModeButton: document.getElementById("mode-preview-btn"),
                editModeButton: document.getElementById("mode-edit-btn"),
                fileInput: document.getElementById("fileInput"),
                fileInputText: document.querySelector(".file-input-text"),
                exportButton: document.getElementById("export-btn"),
                saveJsonButton: document.getElementById("save-json-btn"),
                topbar: document.querySelector(".topbar"),
                contextMenu: document.getElementById("node-context-menu"),
                relationEditorModal: document.getElementById("relation-editor-modal"),
                relationEditorTitle: document.getElementById("relation-editor-title"),
                relationEditorDescription: document.getElementById("relation-editor-description"),
                relationEditorInput: document.getElementById("relation-editor-input"),
                relationEditorSaveButton: document.getElementById("relation-editor-save"),
                relationEditorCancelButton: document.getElementById("relation-editor-cancel"),
                nodeDetailModal: document.getElementById("node-detail-modal"),
                nodeDetailTitle: document.getElementById("node-detail-title"),
                nodeDetailSubtitle: document.getElementById("node-detail-subtitle"),
                nodeDetailFields: document.getElementById("node-detail-fields"),
                nodeDetailJson: document.getElementById("node-detail-json"),
                nodeDetailCloseButton: document.getElementById("node-detail-close"),
            };
        }

        return domCache;
    }

    function resetGraphData() {
        data.currentRoot = null;
        data.currentSelection = null;
        data.history = [];
        data.stageData = null;
        data.zoomScale = 1;
        data.minZoomScale = 1;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function structuredCloneValue(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function truncate(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }

        return `${text.slice(0, maxLength - 1)}...`;
    }

    function sanitizeNodeLabel(text) {
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

    GraphApp.state = {
        data,
        theme,
        constants,
        getDom,
        resetGraphData,
        utils: {
            clamp,
            sanitizeNodeLabel,
            structuredCloneValue,
            truncate,
        },
    };
})();
