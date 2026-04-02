import {
  COLOR_FIELDS,
  COMMON_FONT_OPTIONS,
  FIELD_MAP,
  NUMERIC_FIELDS
} from "./constants.js";

export function createRenderer({ state, ui, model, actions }) {
  function updateSource() {
    ui.sourceEditor.value = model.serialize();
  }

  function syncChrome() {
    ui.appShell.classList.toggle("is-topbar-collapsed", state.topbarCollapsed);
    ui.appShell.classList.toggle("is-left-hidden", state.leftPanelHidden);
    ui.appShell.classList.toggle("is-right-hidden", state.rightPanelHidden);
    ui.workspaceSurface.classList.toggle("is-grid-snap", state.gridSnapEnabled);

    ui.showTopbarButton.classList.toggle("hidden", !state.topbarCollapsed);
    ui.collapseTopbarButton.querySelector(".tool-label").textContent = state.topbarCollapsed ? "Show" : "Hide";
    ui.collapseTopbarButton.querySelector(".tool-icon").textContent = state.topbarCollapsed ? "+" : "-";
    ui.collapseTopbarButton.title = state.topbarCollapsed ? "Show toolbar" : "Hide toolbar";
    ui.gridSnapButton.classList.toggle("is-active", state.gridSnapEnabled);
    ui.gridSnapButton.setAttribute("aria-pressed", String(state.gridSnapEnabled));
    ui.gridSnapButton.title = state.gridSnapEnabled ? "Disable grid snap" : "Enable grid snap";

    ui.floatingLeftButton.textContent = state.leftPanelHidden ? "Show Left" : "Hide Left";
    ui.floatingLeftButton.classList.toggle("is-active", !state.leftPanelHidden);
    ui.hideLeftPanelButton.textContent = state.leftPanelHidden ? "+" : "X";

    ui.floatingRightButton.textContent = state.rightPanelHidden ? "Show Right" : "Hide Right";
    ui.floatingRightButton.classList.toggle("is-active", !state.rightPanelHidden);
    ui.hideRightPanelButton.textContent = state.rightPanelHidden ? "+" : "X";
  }

  function applyZoom() {
    ui.svgHost.style.transform = `scale(${state.zoom})`;
    ui.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function updateActions() {
    const active = state.nodeMap.get(state.selectedId);
    const canChange = Boolean(active && active !== state.svgRoot && !model.isNodeLocked(active));
    ui.undoButton.disabled = state.historyIndex <= 0;
    ui.redoButton.disabled = state.historyIndex >= state.history.length - 1 || state.historyIndex < 0;
    ui.duplicateButton.disabled = !canChange;
    ui.deleteButton.disabled = !canChange;
  }

  function getFieldValue(node, field) {
    return field.kind === "readonly"
      ? field.value(node)
      : field.kind === "text"
        ? (node.textContent ?? "")
        : (node.getAttribute(field.key) ?? "");
  }

  function getNodeParentLabel(node) {
    if (node === state.svgRoot) {
      return "Canvas";
    }

    const parent = node.parentElement;
    if (!parent || parent === node) {
      return "None";
    }

    return model.labelFor(parent);
  }

  function getInspectorNodeName(node) {
    if (node === state.svgRoot) {
      return "SVG Document";
    }

    return model.labelFor(node);
  }

  function getNodeStatusTokens(node) {
    const tokens = [node.tagName.toLowerCase()];
    tokens.push(model.isNodeHidden(node) ? "Hidden" : "Visible");
    if (model.isNodeLocked(node)) {
      tokens.push("Locked");
    }
    return tokens;
  }

  function getQuickFieldKeys(node) {
    const tag = node.tagName.toLowerCase();
    if (tag === "circle") return ["fill", "stroke", "stroke-width", "opacity", "cx", "cy", "r"];
    if (tag === "ellipse") return ["fill", "stroke", "stroke-width", "opacity", "cx", "cy", "rx", "ry"];
    if (tag === "line") return ["stroke", "stroke-width", "opacity", "x1", "y1", "x2", "y2"];
    if (tag === "text" || tag === "tspan") return ["textContent", "fill", "opacity", "x", "y", "font-size", "font-family"];
    if (tag === "path") return ["fill", "stroke", "stroke-width", "opacity", "d"];
    return ["fill", "stroke", "stroke-width", "opacity", "x", "y", "width", "height"];
  }

  function getInspectorSections(node) {
    const quick = getQuickFieldKeys(node)
      .map((key) => FIELD_MAP.get(key))
      .filter((field) => field && model.visibleField(node, field));
    const used = new Set(quick.map((field) => field.key));
    const collect = (keys) => keys
      .map((key) => FIELD_MAP.get(key))
      .filter((field) => field && model.visibleField(node, field) && !used.has(field.key))
      .map((field) => {
        used.add(field.key);
        return field;
      });

    return [
      { title: "Quick Edit", open: true, fields: quick },
      { title: "Geometry", open: false, fields: collect(["x", "y", "width", "height", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry"]) },
      { title: "Appearance", open: false, fields: collect(["fill", "stroke", "stroke-width", "opacity", "font-size", "font-family"]) },
      { title: "Transform", open: false, fields: collect(["transform"]) },
      { title: "Content", open: quick.some((field) => ["textContent", "d", "points"].includes(field.key)), fields: collect(["textContent", "d", "points"]) },
      { title: "Metadata", open: false, fields: collect(["tagName", "id", "class"]) }
    ].filter((section) => section.fields.length);
  }

  function isHexColor(value) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
  }

  function normalizeColorValue(value) {
    const trimmed = value.trim();
    if (isHexColor(trimmed)) {
      if (trimmed.length === 4) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
      }
      return trimmed.toLowerCase();
    }

    const rgbMatch = trimmed.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!rgbMatch) {
      return null;
    }

    const values = rgbMatch.slice(1).map((part) => Math.max(0, Math.min(255, Number(part))));
    return `#${values.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  }

  function syncFontPreset(select, value) {
    const normalized = value.trim();
    const customOption = select.querySelector("option[data-font-custom='true']");
    if (customOption) {
      customOption.remove();
    }

    if (!normalized) {
      select.value = "";
      return;
    }

    const presetMatch = [...select.options].find((option) => option.value === normalized);
    if (presetMatch) {
      select.value = normalized;
      return;
    }

    const option = document.createElement("option");
    option.value = normalized;
    option.textContent = `Current (${normalized})`;
    option.dataset.fontCustom = "true";
    option.style.fontFamily = normalized;
    select.append(option);
    select.value = normalized;
  }

  function createInspectorField(node, field, locked) {
    const row = ui.fieldTemplate.content.firstElementChild.cloneNode(true);
    row.classList.add("inspector-field");
    const label = row.querySelector(".field-label");
    const originalInput = row.querySelector(".field-input");
    const value = getFieldValue(node, field);
    label.textContent = field.label;

    if (field.multiline) {
      const input = document.createElement("textarea");
      input.className = `${originalInput.className} inspector-textarea`;
      originalInput.replaceWith(input);
      input.value = value;
      if (field.kind === "readonly") input.readOnly = true;
      if (locked && field.kind !== "readonly") input.disabled = true;
      const commit = () => actions.updateField(node.dataset.editorId, field, input.value, true);
      if (!locked && field.kind !== "readonly" && field.key !== "id") {
        input.addEventListener("input", () => actions.updateField(node.dataset.editorId, field, input.value, false));
      }
      if (!locked && field.kind !== "readonly") {
        input.addEventListener("change", commit);
        input.addEventListener("blur", commit);
      }
      return row;
    }

    if (COLOR_FIELDS.has(field.key) && field.kind === "attr") {
      row.classList.add("field-row-color");
      const wrapper = document.createElement("div");
      const colorInput = document.createElement("input");
      const textInput = document.createElement("input");
      wrapper.className = "field-combo";
      colorInput.type = "color";
      colorInput.className = "field-swatch";
      textInput.className = `${originalInput.className} field-input-text`;
      textInput.value = value;
      const normalized = normalizeColorValue(value);
      colorInput.value = normalized || "#000000";
      colorInput.disabled = locked;
      textInput.disabled = locked;
      if (!normalized) {
        colorInput.classList.add("is-unset");
      }
      colorInput.addEventListener("input", () => {
        textInput.value = colorInput.value;
        colorInput.classList.remove("is-unset");
        actions.updateField(node.dataset.editorId, field, colorInput.value, false);
      });
      colorInput.addEventListener("change", () => actions.updateField(node.dataset.editorId, field, colorInput.value, true));
      textInput.addEventListener("input", () => {
        const nextNormalized = normalizeColorValue(textInput.value);
        if (nextNormalized) {
          colorInput.value = nextNormalized;
          colorInput.classList.remove("is-unset");
        } else {
          colorInput.classList.add("is-unset");
        }
        actions.updateField(node.dataset.editorId, field, textInput.value, false);
      });
      textInput.addEventListener("change", () => actions.updateField(node.dataset.editorId, field, textInput.value, true));
      textInput.addEventListener("blur", () => actions.updateField(node.dataset.editorId, field, textInput.value, true));
      originalInput.replaceWith(wrapper);
      wrapper.append(colorInput, textInput);
      return row;
    }

    if (field.key === "font-family" && field.kind === "attr") {
      row.classList.add("field-row-font");
      const wrapper = document.createElement("div");
      const presetInput = document.createElement("select");
      const textInput = document.createElement("input");
      wrapper.className = "field-font";
      presetInput.className = "field-input field-font-select";
      textInput.className = `${originalInput.className} field-input-text`;
      textInput.value = value;
      textInput.placeholder = "Custom font-family stack";
      presetInput.disabled = locked;
      textInput.disabled = locked;

      COMMON_FONT_OPTIONS.forEach((optionConfig) => {
        const option = document.createElement("option");
        option.value = optionConfig.value;
        option.textContent = optionConfig.label;
        option.style.fontFamily = optionConfig.value || "";
        presetInput.append(option);
      });
      syncFontPreset(presetInput, value);

      presetInput.addEventListener("change", () => {
        textInput.value = presetInput.value;
        syncFontPreset(presetInput, textInput.value);
        actions.updateField(node.dataset.editorId, field, textInput.value, true);
      });
      textInput.addEventListener("input", () => {
        syncFontPreset(presetInput, textInput.value);
        actions.updateField(node.dataset.editorId, field, textInput.value, false);
      });
      textInput.addEventListener("change", () => {
        syncFontPreset(presetInput, textInput.value);
        actions.updateField(node.dataset.editorId, field, textInput.value, true);
      });
      textInput.addEventListener("blur", () => {
        syncFontPreset(presetInput, textInput.value);
        actions.updateField(node.dataset.editorId, field, textInput.value, true);
      });

      originalInput.replaceWith(wrapper);
      wrapper.append(presetInput, textInput);
      return row;
    }

    if (field.key === "opacity" && field.kind === "attr") {
      row.classList.add("field-row-range");
      const wrapper = document.createElement("div");
      const rangeInput = document.createElement("input");
      const numberInput = document.createElement("input");
      wrapper.className = "field-range";
      rangeInput.type = "range";
      rangeInput.min = "0";
      rangeInput.max = "1";
      rangeInput.step = "0.01";
      rangeInput.value = value || "1";
      numberInput.type = "number";
      numberInput.min = "0";
      numberInput.max = "1";
      numberInput.step = "0.01";
      numberInput.className = `${originalInput.className} field-input-number`;
      numberInput.value = value || "1";
      rangeInput.disabled = locked;
      numberInput.disabled = locked;
      rangeInput.addEventListener("input", () => {
        numberInput.value = rangeInput.value;
        actions.updateField(node.dataset.editorId, field, rangeInput.value, false);
      });
      rangeInput.addEventListener("change", () => actions.updateField(node.dataset.editorId, field, rangeInput.value, true));
      numberInput.addEventListener("input", () => {
        rangeInput.value = numberInput.value || "0";
        actions.updateField(node.dataset.editorId, field, numberInput.value, false);
      });
      numberInput.addEventListener("change", () => actions.updateField(node.dataset.editorId, field, numberInput.value, true));
      numberInput.addEventListener("blur", () => actions.updateField(node.dataset.editorId, field, numberInput.value, true));
      originalInput.replaceWith(wrapper);
      wrapper.append(rangeInput, numberInput);
      return row;
    }

    const input = originalInput;
    input.value = value;
    if (field.kind === "readonly") input.readOnly = true;
    if (NUMERIC_FIELDS.has(field.key) && field.kind !== "readonly") {
      input.type = "number";
      input.step = field.key === "opacity" ? "0.01" : "any";
    }
    if (locked && field.kind !== "readonly") input.disabled = true;
    const commit = () => actions.updateField(node.dataset.editorId, field, input.value, true);
    if (!locked && field.kind !== "readonly" && field.key !== "id") {
      input.addEventListener("input", () => actions.updateField(node.dataset.editorId, field, input.value, false));
    }
    if (!locked && field.kind !== "readonly") {
      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);
    }
    return row;
  }

  function renderTree() {
    ui.treePanel.innerHTML = "";
    if (!state.svgRoot) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const walk = (node, depth) => {
      if (node.tagName.toLowerCase() === "style") {
        return;
      }

      const children = model.getRenderableChildren(node);
      const hasChildren = children.length > 0;
      const collapsed = state.collapsedNodeKeys.has(model.getNodeKey(node));
      const locked = model.isNodeLocked(node);
      const hidden = model.isNodeHidden(node);
      const row = document.createElement("div");
      const main = document.createElement("div");
      const expander = document.createElement("button");
      const selectButton = document.createElement("button");
      const dot = document.createElement("span");
      const tag = document.createElement("span");
      const label = document.createElement("span");

      row.className = "tree-item";
      if (node.dataset.editorId === state.selectedId) row.classList.add("is-selected");
      if (locked) row.classList.add("is-locked");
      if (hidden) row.classList.add("is-hidden");
      row.style.setProperty("--depth", depth);

      main.className = "tree-main";
      expander.type = "button";
      expander.className = "tree-expander";
      expander.textContent = hasChildren ? (collapsed ? "+" : "-") : ".";
      if (!hasChildren) {
        expander.classList.add("is-placeholder");
        expander.disabled = true;
      } else {
        expander.addEventListener("click", (event) => {
          event.stopPropagation();
          actions.toggleNodeCollapse(node.dataset.editorId);
        });
      }

      selectButton.type = "button";
      selectButton.className = "tree-select";
      dot.className = "tree-dot";
      tag.className = "tree-tag";
      label.className = "tree-label";
      tag.textContent = node.tagName.toLowerCase();
      label.textContent = model.labelFor(node);
      selectButton.append(dot, tag, label);
      selectButton.addEventListener("click", () => actions.selectNode(node.dataset.editorId));
      main.append(expander, selectButton);

      const actionsRow = document.createElement("div");
      const visibilityButton = document.createElement("button");
      const lockButton = document.createElement("button");
      actionsRow.className = "tree-actions";
      visibilityButton.type = "button";
      visibilityButton.className = `tree-action${!hidden ? " is-active" : ""}`;
      visibilityButton.textContent = hidden ? "Show" : "Hide";
      visibilityButton.title = hidden ? "Show layer" : "Hide layer";
      visibilityButton.disabled = node === state.svgRoot;
      visibilityButton.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.toggleNodeVisibility(node.dataset.editorId);
      });
      lockButton.type = "button";
      lockButton.className = `tree-action${locked ? " is-active" : ""}`;
      lockButton.textContent = locked ? "Unlock" : "Lock";
      lockButton.title = locked ? "Unlock layer" : "Lock layer";
      lockButton.disabled = node === state.svgRoot;
      lockButton.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.toggleNodeLock(node.dataset.editorId);
      });
      actionsRow.append(visibilityButton, lockButton);

      row.append(main, actionsRow);
      fragment.append(row);
      if (!collapsed) {
        children.forEach((child) => walk(child, depth + 1));
      }
    };

    walk(state.svgRoot, 0);
    ui.treePanel.append(fragment);
    ui.nodeCountBadge.textContent = `${state.svgRoot.querySelectorAll("*").length + 1} nodes`;
  }

  function renderInspector() {
    const node = state.nodeMap.get(state.selectedId);
    if (!node) {
      ui.inspectorEmpty.classList.remove("hidden");
      ui.propertyForm.classList.add("hidden");
      ui.propertyForm.innerHTML = "";
      return;
    }

    ui.inspectorEmpty.classList.add("hidden");
    ui.propertyForm.classList.remove("hidden");
    ui.propertyForm.innerHTML = "";
    const locked = model.isNodeLocked(node);
    const hidden = model.isNodeHidden(node);

    const objectCard = document.createElement("section");
    const objectTop = document.createElement("div");
    const objectMeta = document.createElement("div");
    const objectActions = document.createElement("div");
    const typeChip = document.createElement("span");
    const name = document.createElement("strong");
    const parentMeta = document.createElement("span");
    const statusMeta = document.createElement("span");
    const visibilityButton = document.createElement("button");
    const lockButton = document.createElement("button");

    objectCard.className = "inspector-card inspector-object-card";
    objectTop.className = "inspector-object-top";
    objectMeta.className = "inspector-object-meta";
    objectActions.className = "inspector-action-row";
    typeChip.className = "inspector-type-chip";
    name.className = "inspector-object-name";
    typeChip.textContent = node.tagName.toLowerCase();
    name.textContent = getInspectorNodeName(node);
    parentMeta.textContent = `Parent: ${getNodeParentLabel(node)}`;
    statusMeta.textContent = getNodeStatusTokens(node).join(" | ");

    visibilityButton.type = "button";
    visibilityButton.className = "inspector-action-button";
    visibilityButton.textContent = hidden ? "Show" : "Hide";
    visibilityButton.disabled = node === state.svgRoot;
    visibilityButton.addEventListener("click", () => actions.toggleNodeVisibility(node.dataset.editorId));

    lockButton.type = "button";
    lockButton.className = "inspector-action-button";
    lockButton.textContent = locked ? "Unlock" : "Lock";
    lockButton.disabled = node === state.svgRoot;
    lockButton.addEventListener("click", () => actions.toggleNodeLock(node.dataset.editorId));

    objectTop.append(typeChip, name);
    objectMeta.append(parentMeta, statusMeta);
    objectActions.append(visibilityButton, lockButton);
    objectCard.append(objectTop, objectMeta, objectActions);
    ui.propertyForm.append(objectCard);

    if (locked) {
      const note = document.createElement("p");
      note.className = "inspector-note";
      note.textContent = "This layer is locked. Unlock it to edit attributes.";
      ui.propertyForm.append(note);
    }

    getInspectorSections(node).forEach((section) => {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const content = document.createElement("div");
      details.className = "inspector-card inspector-section";
      if (section.open) details.open = true;
      summary.className = "inspector-section-summary";
      summary.textContent = section.title;
      content.className = "inspector-section-body";
      if (section.title === "Quick Edit") {
        content.classList.add("inspector-quick-grid");
      }
      section.fields.forEach((field) => content.append(createInspectorField(node, field, locked)));
      details.append(summary, content);
      ui.propertyForm.append(details);
    });
  }

  function renderOverlay() {
    ui.overlay.innerHTML = "";
    const node = state.nodeMap.get(state.selectedId);
    if (!node) {
      ui.statusPill.textContent = "No selection";
      return;
    }

    ui.statusPill.textContent = `${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
    if (node === state.svgRoot) {
      return;
    }

    try {
      const box = node.getBBox();
      if (!box.width || !box.height) {
        return;
      }
      const padding = Math.max(2, Math.min(box.width, box.height) * 0.03);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(box.x - padding));
      rect.setAttribute("y", String(box.y - padding));
      rect.setAttribute("width", String(box.width + padding * 2));
      rect.setAttribute("height", String(box.height + padding * 2));
      rect.setAttribute("rx", "8");
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", "#0f766e");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("stroke-dasharray", "10 8");
      ui.overlay.append(rect);
    } catch (error) {
      ui.statusPill.textContent = `${node.tagName.toLowerCase()} selected`;
    }
  }

  function renderWorkspace() {
    ui.overlay.innerHTML = "";
    if (!state.svgRoot) {
      return;
    }

    state.svgRoot.classList.add("workspace-svg");
    const viewBox = model.getViewBoxRect();
    ui.svgHost.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
    const currentSvg = ui.svgHost.querySelector(".workspace-svg");
    if (currentSvg && currentSvg !== state.svgRoot) {
      currentSvg.remove();
    }

    ui.svgHost.prepend(state.svgRoot);
    ui.svgHost.append(ui.overlay);
    ui.overlay.setAttribute("viewBox", model.viewBoxFor(state.svgRoot));
    ui.overlay.setAttribute("preserveAspectRatio", state.svgRoot.getAttribute("preserveAspectRatio") || "xMidYMid meet");
    state.svgRoot.removeEventListener("click", actions.onSvgClick);
    state.svgRoot.removeEventListener("pointerdown", actions.onSvgPointerDown);
    state.svgRoot.addEventListener("click", actions.onSvgClick);
    state.svgRoot.addEventListener("pointerdown", actions.onSvgPointerDown);
    applyZoom();
    renderOverlay();
  }

  return {
    applyZoom,
    renderInspector,
    renderOverlay,
    renderTree,
    renderWorkspace,
    syncChrome,
    updateActions,
    updateSource
  };
}
