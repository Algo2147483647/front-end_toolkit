import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRuntimeVersion } from "./use-runtime-version";
import {
  COLOR_FIELDS,
  COMMON_FONT_OPTIONS,
  COMMON_FONT_SIZE_OPTIONS,
  COMMON_FONT_WEIGHT_OPTIONS,
  FIELD_MAP,
  getFieldValue,
  getInspectorNodeName,
  getInspectorSections,
  getNodeParentLabel,
  getNodeStatusTokens,
  getOptionSet,
  getQuickFieldVariant,
  getResolvedTextStyle,
  isBoldStyleValue,
  isItalicStyleValue,
  isSectionOpen,
  isTransparentColorValue,
  normalizeColorValue,
  normalizeFontSizeValue,
  rememberSectionState,
  getTextDecorationTokens
} from "./inspector-utils";

interface InspectorDeps {
  store: any;
  state: any;
  ui: any;
  model: any;
  actions: any;
}

function useDraftValue(value: string | number) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);
  return [draft, setDraft] as const;
}

function addCurrentOption(options: Array<{ label: string; value: string }>, value: string, prefix = "Current") {
  const normalized = String(value || "").trim();
  if (!normalized || options.some((option) => option.value === normalized)) {
    return options;
  }

  return [...options, { label: `${prefix} (${normalized})`, value: normalized }];
}

function commitField(actions: any, node: SVGElement, field: any, value: string, record: boolean) {
  actions.updateField(node.dataset.editorId, field, value, record);
}

function DefaultField({ actions, field, locked, node, value }: any) {
  const [draft, setDraft] = useDraftValue(value);
  const isReadonly = field.kind === "readonly";

  return (
    <input
      className="field-input"
      type={isReadonly ? "text" : undefined}
      value={draft}
      readOnly={isReadonly}
      disabled={locked && !isReadonly}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        if (!isReadonly) {
          commitField(actions, node, field, nextValue, true);
        }
      }}
      onInput={(event) => {
        const nextValue = (event.target as HTMLInputElement).value;
        setDraft(nextValue);
        if (!locked && !isReadonly && field.key !== "id") {
          commitField(actions, node, field, nextValue, false);
        }
      }}
      onBlur={() => {
        if (!isReadonly && !locked) {
          commitField(actions, node, field, draft, true);
        }
      }}
    />
  );
}

function MultilineField({ actions, field, locked, node, value }: any) {
  const [draft, setDraft] = useDraftValue(value);
  return (
    <textarea
      className="field-input inspector-textarea"
      value={draft}
      readOnly={field.kind === "readonly"}
      disabled={locked && field.kind !== "readonly"}
      onInput={(event) => {
        const nextValue = (event.target as HTMLTextAreaElement).value;
        setDraft(nextValue);
        if (!locked && field.kind !== "readonly" && field.key !== "id") {
          commitField(actions, node, field, nextValue, false);
        }
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        if (!locked && field.kind !== "readonly") {
          commitField(actions, node, field, nextValue, true);
        }
      }}
      onBlur={() => {
        if (!locked && field.kind !== "readonly") {
          commitField(actions, node, field, draft, true);
        }
      }}
    />
  );
}

function ColorField({ actions, field, locked, node, value }: any) {
  const [draft, setDraft] = useDraftValue(value);
  const normalized = normalizeColorValue(draft) || "#000000";
  const transparent = isTransparentColorValue(draft);

  return (
    <div className="field-combo">
      <input
        type="color"
        className={`field-swatch${normalizeColorValue(draft) ? "" : " is-unset"}${transparent ? " is-transparent" : ""}`}
        value={normalized}
        disabled={locked}
        onInput={(event) => {
          const nextValue = (event.target as HTMLInputElement).value;
          setDraft(nextValue);
          commitField(actions, node, field, nextValue, false);
        }}
        onChange={(event) => commitField(actions, node, field, event.target.value, true)}
      />
      <input
        className="field-input field-input-text"
        value={draft}
        placeholder="Color or transparent"
        disabled={locked}
        onInput={(event) => {
          const nextValue = (event.target as HTMLInputElement).value;
          setDraft(nextValue);
          commitField(actions, node, field, nextValue, false);
        }}
        onChange={(event) => commitField(actions, node, field, event.target.value, true)}
        onBlur={() => commitField(actions, node, field, draft, true)}
      />
      <button
        type="button"
        className={`field-chip-button field-chip-button--transparent${transparent ? " is-active" : ""}`}
        aria-label="Transparent"
        title="Transparent"
        disabled={locked}
        onClick={() => {
          setDraft("transparent");
          commitField(actions, node, field, "transparent", true);
        }}
      />
    </div>
  );
}

function ComboField({ actions, field, locked, node, options, placeholder, value }: any) {
  const [draft, setDraft] = useDraftValue(value);
  const renderedOptions = useMemo(() => addCurrentOption(options, draft), [draft, options]);

  return (
    <div className="field-font">
      <select
        className="field-input field-font-select"
        value={renderedOptions.some((option) => option.value === draft) ? draft : ""}
        disabled={locked}
        onChange={(event) => {
          setDraft(event.target.value);
          commitField(actions, node, field, event.target.value, true);
        }}
      >
        {renderedOptions.map((option) => (
          <option key={`${field.key}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        className="field-input field-input-text"
        value={draft}
        placeholder={placeholder}
        disabled={locked}
        onInput={(event) => {
          const nextValue = (event.target as HTMLInputElement).value;
          setDraft(nextValue);
          commitField(actions, node, field, nextValue, false);
        }}
        onChange={(event) => commitField(actions, node, field, event.target.value, true)}
        onBlur={() => commitField(actions, node, field, draft, true)}
      />
    </div>
  );
}

function OptionField({ actions, field, locked, node, options, value }: any) {
  const renderedOptions = useMemo(() => addCurrentOption(options, value), [options, value]);
  return (
    <select
      className="field-input field-select"
      value={String(value || "")}
      disabled={locked}
      onChange={(event) => commitField(actions, node, field, event.target.value, true)}
    >
      {renderedOptions.map((option) => (
        <option key={`${field.key}-${option.value}`} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function RangeField({ actions, field, locked, node, value }: any) {
  const [draft, setDraft] = useDraftValue(value || "1");
  const parsedValue = Number.parseFloat(String(value));
  const rangeMax = field.key === "opacity"
    ? "1"
    : String(Math.max(32, Math.ceil((Number.isFinite(parsedValue) ? parsedValue : 1) * 2)));

  return (
    <div className="field-range">
      <input
        type="range"
        min="0"
        max={rangeMax}
        step={field.key === "opacity" ? "0.01" : "0.5"}
        value={draft}
        disabled={locked}
        onInput={(event) => {
          const nextValue = (event.target as HTMLInputElement).value;
          setDraft(nextValue);
          commitField(actions, node, field, nextValue, false);
        }}
        onChange={(event) => commitField(actions, node, field, event.target.value, true)}
      />
      <input
        type="number"
        min="0"
        max={rangeMax}
        step={field.key === "opacity" ? "0.01" : "0.5"}
        className="field-input field-input-number"
        value={draft}
        disabled={locked}
        onInput={(event) => {
          const nextValue = (event.target as HTMLInputElement).value;
          setDraft(nextValue);
          commitField(actions, node, field, nextValue, false);
        }}
        onChange={(event) => commitField(actions, node, field, event.target.value, true)}
        onBlur={() => commitField(actions, node, field, draft, true)}
      />
    </div>
  );
}

function CountField({ actions, field, locked, node, value, min, max, hint, onCommit }: any) {
  const [draft, setDraft] = useDraftValue(value);

  return (
    <div className="inspector-geometry-control">
      <input
        type="number"
        className="field-input inspector-geometry-input"
        min={String(min)}
        max={String(max)}
        step="1"
        value={draft}
        disabled={locked}
        onChange={(event) => {
          setDraft(event.target.value);
          onCommit(event.target.value);
        }}
        onBlur={() => onCommit(draft)}
      />
      <p className="inspector-geometry-note">{hint}</p>
    </div>
  );
}

function ActionField({ buttons, hint }: any) {
  return (
    <div className="inspector-geometry-control">
      <div className="inspector-action-group">
        {buttons.map((button: any) => (
          <button
            key={button.label}
            type="button"
            className="inspector-action-button inspector-inline-action-button"
            disabled={button.disabled}
            onClick={button.onClick}
          >
            {button.label}
          </button>
        ))}
      </div>
      <p className="inspector-geometry-note">{hint}</p>
    </div>
  );
}

function BezierField({ actions, locked, model, node }: any) {
  const bezier = model.getPathBezier(node);
  const [draft, setDraft] = useState(() => bezier ?? null);

  useEffect(() => {
    setDraft(bezier ?? null);
  }, [bezier, node]);

  if (!draft) {
    return <p className="inspector-geometry-note">Bezier editor currently supports single cubic paths only.</p>;
  }

  const pointConfigs = [
    ["start", "Start"],
    ["control1", "Control A"],
    ["control2", "Control B"],
    ["end", "End"]
  ];

  const updatePoint = (pointKey: string, axis: "x" | "y", nextValue: string, record: boolean) => {
    const nextDraft = {
      ...draft,
      [pointKey]: {
        ...draft[pointKey],
        [axis]: nextValue
      }
    };
    setDraft(nextDraft);
    actions.updatePathBezier(node.dataset.editorId, nextDraft, record);
  };

  return (
    <div className="inspector-geometry-control inspector-bezier-control">
      <div className="inspector-bezier-grid">
        {pointConfigs.map(([key, title]) => (
          <div className="inspector-bezier-point" key={key}>
            <span className="inspector-bezier-label">{title}</span>
            <div className="inspector-bezier-pair">
              <input
                type="number"
                step="any"
                className="field-input inspector-geometry-input"
                value={draft[key].x}
                disabled={locked}
                onInput={(event) => updatePoint(key, "x", (event.target as HTMLInputElement).value, false)}
                onChange={(event) => updatePoint(key, "x", event.target.value, true)}
                onBlur={(event) => updatePoint(key, "x", event.target.value, true)}
              />
              <input
                type="number"
                step="any"
                className="field-input inspector-geometry-input"
                value={draft[key].y}
                disabled={locked}
                onInput={(event) => updatePoint(key, "y", (event.target as HTMLInputElement).value, false)}
                onChange={(event) => updatePoint(key, "y", event.target.value, true)}
                onBlur={(event) => updatePoint(key, "y", event.target.value, true)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypographyField({ actions, locked, node }: any) {
  const weightField = FIELD_MAP.get("font-weight");
  const styleField = FIELD_MAP.get("font-style");
  const decorationField = FIELD_MAP.get("text-decoration");
  const fontWeight = getResolvedTextStyle(node, "font-weight");
  const fontStyle = getResolvedTextStyle(node, "font-style");
  const decoration = getResolvedTextStyle(node, "text-decoration");
  const tokens = getTextDecorationTokens(decoration);

  return (
    <div className="inspector-typography">
      <div className="inspector-typography-pair">
        <div className="inspector-typography-metric">
          <span className="inspector-typography-metric-label">Size</span>
          <ComboField
            actions={actions}
            field={FIELD_MAP.get("font-size")}
            locked={locked}
            node={node}
            options={COMMON_FONT_SIZE_OPTIONS}
            placeholder="16 or 16px"
            value={getFieldValue({ getTextBoxDimension: () => "", getZOrder: () => "", visibleField: () => true }, node, FIELD_MAP.get("font-size")) || normalizeFontSizeValue(getResolvedTextStyle(node, "font-size"))}
          />
        </div>
        <div className="inspector-typography-metric">
          <span className="inspector-typography-metric-label">Weight</span>
          <ComboField
            actions={actions}
            field={weightField}
            locked={locked}
            node={node}
            options={COMMON_FONT_WEIGHT_OPTIONS}
            placeholder="400, 700, bold"
            value={node.getAttribute("font-weight") || fontWeight || ""}
          />
        </div>
      </div>

      <div className="inspector-toggle-group inspector-typography-actions">
        <button
          type="button"
          className={`inspector-toggle-button inspector-toggle-button--bold${isBoldStyleValue(fontWeight) ? " is-active" : ""}`}
          title="Toggle bold"
          aria-pressed={isBoldStyleValue(fontWeight)}
          disabled={locked}
          onClick={() => actions.updateField(node.dataset.editorId, weightField, isBoldStyleValue(fontWeight) ? "400" : "700", true)}
        >
          B
        </button>
        <button
          type="button"
          className={`inspector-toggle-button inspector-toggle-button--italic${isItalicStyleValue(fontStyle) ? " is-active" : ""}`}
          title="Toggle italic"
          aria-pressed={isItalicStyleValue(fontStyle)}
          disabled={locked}
          onClick={() => actions.updateField(node.dataset.editorId, styleField, isItalicStyleValue(fontStyle) ? "normal" : "italic", true)}
        >
          I
        </button>
        <button
          type="button"
          className={`inspector-toggle-button inspector-toggle-button--underline${tokens.has("underline") ? " is-active" : ""}`}
          title="Toggle underline"
          aria-pressed={tokens.has("underline")}
          disabled={locked}
          onClick={() => {
            const nextTokens = new Set(tokens);
            if (nextTokens.has("underline")) nextTokens.delete("underline");
            else nextTokens.add("underline");
            actions.updateField(node.dataset.editorId, decorationField, nextTokens.size ? [...nextTokens].join(" ") : "none", true);
          }}
        >
          U
        </button>
      </div>
    </div>
  );
}

function FieldControl({ actions, field, locked, model, node }: any) {
  const value = getFieldValue(model, node, field);

  if (field.kind === "typography-controls") {
    return <TypographyField actions={actions} locked={locked} node={node} />;
  }

  if (field.kind === "polygon-sides") {
    return (
      <CountField
        actions={actions}
        field={field}
        hint="Regenerate as a regular polygon inside the current bounds."
        locked={locked}
        max={16}
        min={3}
        node={node}
        onCommit={(nextValue: string) => actions.updatePolygonSides(node.dataset.editorId, nextValue, true)}
        value={model.getPolygonSideCount(node) || 5}
      />
    );
  }

  if (field.kind === "polygon-regularize") {
    return (
      <ActionField
        buttons={[
          { label: "Fit Bounds", disabled: locked, onClick: () => actions.regularizePolygon(node.dataset.editorId) },
          { label: "Equal Sides", disabled: locked, onClick: () => actions.regularizePolygonEqualSides(node.dataset.editorId) }
        ]}
        hint="Fit Bounds keeps the current rectangle; Equal Sides rebuilds a true regular polygon centered in it."
      />
    );
  }

  if (field.kind === "polyline-points") {
    return (
      <CountField
        actions={actions}
        field={field}
        hint="Resample the current line while keeping its overall shape."
        locked={locked}
        max={24}
        min={2}
        node={node}
        onCommit={(nextValue: string) => actions.updatePolylinePointCount(node.dataset.editorId, nextValue, true)}
        value={model.getPolylinePointCount(node) || 4}
      />
    );
  }

  if (field.kind === "path-bezier") {
    return <BezierField actions={actions} locked={locked} model={model} node={node} />;
  }

  if (field.multiline) {
    return <MultilineField actions={actions} field={field} locked={locked} node={node} value={value} />;
  }

  if (COLOR_FIELDS.has(field.key) && field.kind === "attr") {
    return <ColorField actions={actions} field={field} locked={locked} node={node} value={value} />;
  }

  if (field.key === "font-family" && field.kind === "attr") {
    return (
      <ComboField
        actions={actions}
        field={field}
        locked={locked}
        node={node}
        options={COMMON_FONT_OPTIONS}
        placeholder="Custom font-family stack"
        value={value}
      />
    );
  }

  if (field.key === "font-size" && field.kind === "attr") {
    return (
      <ComboField
        actions={actions}
        field={field}
        locked={locked}
        node={node}
        options={COMMON_FONT_SIZE_OPTIONS}
        placeholder="16 or 16px"
        value={value || normalizeFontSizeValue(getResolvedTextStyle(node, "font-size"))}
      />
    );
  }

  if (field.key === "font-weight" && field.kind === "attr") {
    return (
      <ComboField
        actions={actions}
        field={field}
        locked={locked}
        node={node}
        options={COMMON_FONT_WEIGHT_OPTIONS}
        placeholder="400, 700, bold"
        value={value || getResolvedTextStyle(node, "font-weight")}
      />
    );
  }

  if (field.kind === "attr" && getOptionSet(field)) {
    return <OptionField actions={actions} field={field} locked={locked} node={node} options={getOptionSet(field)} value={value} />;
  }

  if (["opacity", "stroke-width"].includes(field.key) && field.kind === "attr") {
    return <RangeField actions={actions} field={field} locked={locked} node={node} value={value} />;
  }

  return <DefaultField actions={actions} field={field} locked={locked} node={node} value={value} />;
}

function InspectorField({ actions, field, locked, model, node, quickEdit }: any) {
  return (
    <label
      className={[
        "field-row",
        "inspector-field",
        quickEdit ? "inspector-field--quick" : "",
        quickEdit ? `inspector-field--${getQuickFieldVariant(field)}` : ""
      ].filter(Boolean).join(" ")}
    >
      <span className="field-label">{field.label}</span>
      <FieldControl
        actions={actions}
        field={field}
        locked={locked}
        model={model}
        node={node}
      />
    </label>
  );
}

function SingleNodeInspector({ actions, model, node, state, store }: any) {
  const locked = model.isNodeLocked(node);
  const hidden = model.isNodeHidden(node);

  return (
    <>
      <section className="inspector-card inspector-object-card">
        <div className="inspector-object-top">
          <span className="inspector-type-chip">{node.tagName.toLowerCase()}</span>
          <strong className="inspector-object-name">{getInspectorNodeName(state, model, node)}</strong>
        </div>
        <div className="inspector-object-meta">
          <span>{`Parent: ${getNodeParentLabel(state, model, node)}`}</span>
          <span>{getNodeStatusTokens(model, node).join(" | ")}</span>
        </div>
        <div className="inspector-action-row">
          <button
            type="button"
            className="inspector-action-button"
            disabled={node === state.svgRoot}
            onClick={() => actions.toggleNodeVisibility(node.dataset.editorId)}
          >
            {hidden ? "Show" : "Hide"}
          </button>
          <button
            type="button"
            className="inspector-action-button"
            disabled={node === state.svgRoot}
            onClick={() => actions.toggleNodeLock(node.dataset.editorId)}
          >
            {locked ? "Unlock" : "Lock"}
          </button>
        </div>
      </section>

      {locked ? (
        <p className="inspector-note">This layer is locked. Unlock it to edit attributes.</p>
      ) : null}

      {getInspectorSections(model, node).map((section: any) => (
        <details
          key={section.title}
          className="inspector-card inspector-section"
          open={isSectionOpen(state, node, section)}
          onToggle={(event) => rememberSectionState(store, state, node, section.title, (event.target as HTMLDetailsElement).open)}
        >
          <summary className="inspector-section-summary">{section.title}</summary>
          <div className={`inspector-section-body${section.title === "Quick Edit" ? " inspector-quick-grid" : ""}`}>
            {section.fields.map((field: any) => (
              <InspectorField
                key={field.key}
                actions={actions}
                field={field}
                locked={locked}
                model={model}
                node={node}
                quickEdit={section.title === "Quick Edit"}
              />
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

function InspectorPanel({ actions, model, state, store }: Omit<InspectorDeps, "ui">) {
  const selectedNodes = [...state.selectedIds]
    .map((editorId) => state.nodeMap.get(editorId))
    .filter(Boolean);
  const node = state.nodeMap.get(state.selectedId);

  if (!selectedNodes.length || !node) {
    return null;
  }

  if (selectedNodes.length > 1) {
    return (
      <section className="inspector-card inspector-object-card">
        <div className="inspector-object-top">
          <span className="inspector-type-chip">multi</span>
          <strong className="inspector-object-name">{`${selectedNodes.length} objects selected`}</strong>
        </div>
        <div className="inspector-object-meta">
          {selectedNodes.slice(0, 4).map((selectedNode, index) => (
            <Fragment key={selectedNode.dataset.editorId || index}>
              <span>{`${selectedNode.tagName.toLowerCase()} ${model.labelFor(selectedNode)}`}</span>
            </Fragment>
          ))}
        </div>
        <p className="inspector-note">
          Drag any selected object to move the group. Attribute editing is available after reducing the selection to one object.
        </p>
      </section>
    );
  }

  return <SingleNodeInspector actions={actions} model={model} node={node} state={state} store={store} />;
}

function InspectorRendererRoot({ actions, model, store, ui }: InspectorDeps) {
  const version = useRuntimeVersion(store);
  const state = store.getState();
  const hasSelection = [...state.selectedIds].some((editorId) => state.nodeMap.get(editorId));

  useLayoutEffect(() => {
    ui.inspectorEmpty.classList.toggle("hidden", hasSelection);
    ui.propertyForm.classList.toggle("hidden", !hasSelection);
  }, [hasSelection, ui, version]);

  return (
    <InspectorPanel
      actions={actions}
      model={model}
      state={state}
      store={store}
    />
  );
}

export function createReactInspectorRenderer({ store, state, ui, model, actions }: InspectorDeps) {
  const root: Root = createRoot(ui.propertyForm);
  root.render(
    <InspectorRendererRoot
      actions={actions}
      model={model}
      state={state}
      store={store}
      ui={ui}
    />
  );

  function renderInspector() {
    store.invalidate();
  }

  return {
    dispose() {
      root.unmount();
    },
    renderInspector
  };
}
