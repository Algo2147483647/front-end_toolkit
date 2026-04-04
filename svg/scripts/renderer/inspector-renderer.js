import {
  COLOR_FIELDS,
  COMMON_FONT_OPTIONS,
  COMMON_FONT_WEIGHT_OPTIONS,
  FIELD_MAP,
  FONT_STYLE_OPTIONS,
  NUMERIC_FIELDS,
  TEXT_ANCHOR_OPTIONS,
  TEXT_DECORATION_OPTIONS
} from "../constants.js";

const FIELD_OPTION_SETS = new Map([
  ["font-weight", COMMON_FONT_WEIGHT_OPTIONS],
  ["font-style", FONT_STYLE_OPTIONS],
  ["text-decoration", TEXT_DECORATION_OPTIONS],
  ["text-anchor", TEXT_ANCHOR_OPTIONS]
]);

export function createInspectorRenderer({ state, ui, model, actions }) {
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
    if (tag === "text" || tag === "tspan") return ["typography-controls", "textContent", "fill", "opacity"];
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
      { title: "Typography", open: false, fields: collect(["font-family", "font-size", "font-weight", "font-style", "text-decoration", "letter-spacing", "text-anchor"]) },
      { title: "Appearance", open: false, fields: collect(["fill", "stroke", "stroke-width", "opacity"]) },
      { title: "Transform", open: false, fields: collect(["transform"]) },
      { title: "Content", open: quick.some((field) => ["textContent", "d", "points"].includes(field.key)), fields: collect(["textContent", "d", "points"]) },
      { title: "Metadata", open: false, fields: collect(["tagName", "id", "class"]) }
    ].filter((section) => section.fields.length);
  }

  function getOptionSet(field) {
    if (typeof field.options === "string") {
      return FIELD_OPTION_SETS.get(field.options) || [];
    }

    return Array.isArray(field.options) ? field.options : null;
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
    const normalized = (value || "").trim();
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

  function syncOptionPreset(select, value) {
    const normalized = (value || "").trim();
    const customOption = select.querySelector("option[data-option-custom='true']");
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
    option.dataset.optionCustom = "true";
    select.append(option);
    select.value = normalized;
  }

  function getResolvedComputedStyle(node) {
    try {
      return globalThis.getComputedStyle?.(node) || null;
    } catch (error) {
      return null;
    }
  }

  function getResolvedTextStyle(node, attrName) {
    const attrValue = node.getAttribute(attrName)?.trim();
    if (attrValue) {
      return attrValue;
    }

    const computed = getResolvedComputedStyle(node);
    if (!computed) {
      return "";
    }

    if (attrName === "font-weight") {
      return computed.fontWeight || "";
    }

    if (attrName === "font-style") {
      return computed.fontStyle || "";
    }

    if (attrName === "text-decoration") {
      return computed.textDecorationLine || computed.textDecoration || "";
    }

    return "";
  }

  function isBoldStyleValue(value) {
    const normalized = (value || "").trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (normalized === "bold" || normalized === "bolder") {
      return true;
    }

    const numeric = Number.parseInt(normalized, 10);
    return Number.isFinite(numeric) && numeric >= 600;
  }

  function isItalicStyleValue(value) {
    return /(italic|oblique)/i.test((value || "").trim());
  }

  function getTextDecorationTokens(value) {
    return new Set(
      (value || "")
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => ["underline", "overline", "line-through"].includes(token))
    );
  }

  function getQuickFieldVariant(field) {
    if (["typography-controls", "textContent", "d", "points", "font-family"].includes(field.key) || field.multiline) {
      return "full";
    }

    if (["fill", "stroke", "stroke-width", "opacity"].includes(field.key)) {
      return "compact";
    }

    return "default";
  }

  function createTypographyControls(node, field, label, originalInput, locked) {
    const wrapper = document.createElement("div");
    const buttonGroup = document.createElement("div");
    const buttons = [
      {
        label: "B",
        className: "inspector-toggle-button--bold",
        title: "Toggle bold",
        pressed: isBoldStyleValue(getResolvedTextStyle(node, "font-weight")),
        onClick: () => actions.updateField(
          node.dataset.editorId,
          FIELD_MAP.get("font-weight"),
          isBoldStyleValue(getResolvedTextStyle(node, "font-weight")) ? "400" : "700",
          true
        )
      },
      {
        label: "I",
        className: "inspector-toggle-button--italic",
        title: "Toggle italic",
        pressed: isItalicStyleValue(getResolvedTextStyle(node, "font-style")),
        onClick: () => actions.updateField(
          node.dataset.editorId,
          FIELD_MAP.get("font-style"),
          isItalicStyleValue(getResolvedTextStyle(node, "font-style")) ? "normal" : "italic",
          true
        )
      },
      {
        label: "U",
        className: "inspector-toggle-button--underline",
        title: "Toggle underline",
        pressed: getTextDecorationTokens(getResolvedTextStyle(node, "text-decoration")).has("underline"),
        onClick: () => {
          const tokens = getTextDecorationTokens(getResolvedTextStyle(node, "text-decoration"));
          if (tokens.has("underline")) {
            tokens.delete("underline");
          } else {
            tokens.add("underline");
          }

          actions.updateField(
            node.dataset.editorId,
            FIELD_MAP.get("text-decoration"),
            tokens.size ? [...tokens].join(" ") : "none",
            true
          );
        }
      }
    ];

    wrapper.className = "inspector-typography";
    buttonGroup.className = "inspector-toggle-group";
    label.textContent = field.label;
    originalInput.replaceWith(wrapper);

    buttons.forEach((config) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inspector-toggle-button";
      if (config.className) {
        button.classList.add(config.className);
      }
      button.textContent = config.label;
      button.title = config.title;
      button.setAttribute("aria-label", config.title);
      button.setAttribute("aria-pressed", String(config.pressed));
      if (config.pressed) {
        button.classList.add("is-active");
      }
      button.disabled = locked;
      if (!locked) {
        button.addEventListener("click", config.onClick);
      }
      buttonGroup.append(button);
    });

    wrapper.append(buttonGroup);
    return wrapper;
  }

  function createInspectorField(node, field, locked, options = {}) {
    const { quickEdit = false } = options;
    const row = ui.fieldTemplate.content.firstElementChild.cloneNode(true);
    row.classList.add("inspector-field");
    if (quickEdit) {
      row.classList.add("inspector-field--quick", `inspector-field--${getQuickFieldVariant(field)}`);
    }
    const label = row.querySelector(".field-label");
    const originalInput = row.querySelector(".field-input");
    const value = getFieldValue(node, field);
    label.textContent = field.label;

    if (field.kind === "typography-controls") {
      createTypographyControls(node, field, label, originalInput, locked);
      return row;
    }

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

    if (field.kind === "attr" && getOptionSet(field)) {
      const select = document.createElement("select");
      select.className = "field-input field-select";
      select.disabled = locked;

      getOptionSet(field).forEach((optionConfig) => {
        const option = document.createElement("option");
        option.value = optionConfig.value;
        option.textContent = optionConfig.label;
        select.append(option);
      });
      syncOptionPreset(select, value);

      if (!locked) {
        select.addEventListener("change", () => {
          syncOptionPreset(select, select.value);
          actions.updateField(node.dataset.editorId, field, select.value, true);
        });
      }

      originalInput.replaceWith(select);
      return row;
    }

    if (["opacity", "stroke-width"].includes(field.key) && field.kind === "attr") {
      row.classList.add("field-row-range");
      const wrapper = document.createElement("div");
      const rangeInput = document.createElement("input");
      const numberInput = document.createElement("input");
      const parsedValue = Number.parseFloat(value);
      const fallbackValue = field.key === "opacity" ? "1" : "1";
      const rangeMax = field.key === "opacity"
        ? "1"
        : String(Math.max(32, Math.ceil((Number.isFinite(parsedValue) ? parsedValue : 1) * 2)));
      wrapper.className = "field-range";
      rangeInput.type = "range";
      rangeInput.min = "0";
      rangeInput.max = rangeMax;
      rangeInput.step = field.key === "opacity" ? "0.01" : "0.5";
      rangeInput.value = value || fallbackValue;
      numberInput.type = "number";
      numberInput.min = "0";
      numberInput.max = rangeMax;
      numberInput.step = field.key === "opacity" ? "0.01" : "0.5";
      numberInput.className = `${originalInput.className} field-input-number`;
      numberInput.value = value || fallbackValue;
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
      section.fields.forEach((field) => content.append(createInspectorField(node, field, locked, {
        quickEdit: section.title === "Quick Edit"
      })));
      details.append(summary, content);
      ui.propertyForm.append(details);
    });
  }

  return {
    renderInspector
  };
}
