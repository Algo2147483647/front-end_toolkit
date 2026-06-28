import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_OPTIONS,
  SAMPLE_GRAPHS,
  type Connector,
  type GenerationResult,
  type GeneratorOptions,
  type InputGraph,
  generateHighwayNetwork
} from "./generator";
import { HighwayRenderer } from "./render";

type LayerTarget = "validation" | "structures" | "laneGraph";
type VisibilityState = Record<LayerTarget, boolean>;
type DebugState = {
  status?: string;
  interchanges?: number;
  roadSurfaces?: number;
  connectors?: number;
  conflicts?: number;
  structures?: number;
  layers?: number[];
  sceneObjects?: ReturnType<HighwayRenderer["countSceneObjects"]>;
  canvasPixels?: ReturnType<HighwayRenderer["sampleCanvasPixels"]>;
};

const CONTROL_DEFS = [
  { key: "portalDistance", label: "Portal distance", min: 160, max: 620, step: 20 },
  { key: "layerHeight", label: "Layer height", min: 6, max: 14, step: 0.5 },
  { key: "runout", label: "Ramp runout", min: 80, max: 360, step: 20 },
  { key: "minRadius", label: "Min radius", min: 80, max: 300, step: 10 },
  { key: "oneWayRoadWidth", label: "One-way road width", min: 6, max: 24, step: 0.5 },
  { key: "maxVehicleHeight", label: "Max vehicle height", min: 3, max: 8, step: 0.1 }
] as const;

const STATUS_LABELS: Record<string, string> = {
  valid: "Valid",
  "valid-with-warnings": "Valid With Warnings",
  infeasible: "Infeasible"
};

function formatGraph(graph: InputGraph) {
  return JSON.stringify(graph, null, 2);
}

function colorForLayer(layer: number) {
  if (layer === 0) return "#46515a";
  const colors = ["#59c2a6", "#f0b35a", "#8ad8ff", "#db7fb6", "#9cc66f", "#c6a6ff"];
  return colors[Math.abs(layer) % colors.length];
}

function createOptions(options: GeneratorOptions): GeneratorOptions {
  return {
    ...options,
    clearance: options.maxVehicleHeight
  };
}

function runGeneration(graphText: string, options: GeneratorOptions) {
  const graph = JSON.parse(graphText) as InputGraph;
  return generateHighwayNetwork(graph, createOptions(options));
}

export default function App() {
  const [sampleKey, setSampleKey] = useState("stack4");
  const [graphInput, setGraphInput] = useState(() => formatGraph(SAMPLE_GRAPHS.stack4));
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<GenerationResult>(() => runGeneration(formatGraph(SAMPLE_GRAPHS.stack4), DEFAULT_OPTIONS));
  const [error, setError] = useState<string | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState>({
    validation: true,
    structures: true,
    laneGraph: true
  });
  const [debugState, setDebugState] = useState<DebugState>({});

  const connectors = useMemo(
    () => result.network.interchanges.flatMap((interchange) => interchange.connectors),
    [result]
  );

  const stats = useMemo(() => {
    const layers = new Set(connectors.map((connector) => connector.layer));
    return [
      ["Geo nodes", result.network.geoGraph.nodes.length],
      ["Half-edges", result.network.halfEdges.length],
      ["Interchanges", result.network.interchanges.length],
      ["Road surfaces", result.network.roadSurfaces.length],
      ["Movements", result.network.interchanges.reduce((sum, item) => sum + item.movements.length, 0)],
      ["Lane nodes", result.network.laneGraph.nodes.length],
      ["Lane edges", result.network.laneGraph.edges.length],
      ["Vertical layers", layers.size],
      ["Structures", result.network.structures.length]
    ];
  }, [connectors, result]);

  const summary = error
    ? error
    : `${connectors.length} connector ramps, ${result.network.interchanges.reduce((sum, item) => sum + item.conflicts.length, 0)} plan-view conflicts, cost ${result.cost.toLocaleString()}.`;

  const statusText = error ? "Input Error" : STATUS_LABELS[result.status] ?? result.status;
  const statusClass = error || result.status === "infeasible"
    ? "infeasible"
    : result.status === "valid-with-warnings"
      ? "warning"
      : "";

  function generate(nextGraph = graphInput, nextOptions = options) {
    try {
      const nextResult = runGeneration(nextGraph, nextOptions);
      setResult(nextResult);
      setSelectedConnector(null);
      setError(null);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    }
  }

  function updateOption(key: (typeof CONTROL_DEFS)[number]["key"], value: number) {
    const nextOptions = { ...options, [key]: value };
    setOptions(nextOptions);
    generate(graphInput, nextOptions);
  }

  function updateSample(key: string) {
    const nextGraph = formatGraph(SAMPLE_GRAPHS[key]);
    setSampleKey(key);
    setGraphInput(nextGraph);
    generate(nextGraph, options);
  }

  const updateRendererDebug = useCallback((renderer: HighwayRenderer) => {
    setDebugState({
      status: result.status,
      interchanges: result.network.interchanges.length,
      roadSurfaces: result.network.roadSurfaces.length,
      connectors: connectors.length,
      conflicts: result.network.interchanges.reduce((sum, item) => sum + item.conflicts.length, 0),
      structures: result.network.structures.length,
      layers: [...new Set(connectors.map((connector) => connector.layer))],
      sceneObjects: renderer.countSceneObjects(),
      canvasPixels: renderer.sampleCanvasPixels()
    });
  }, [connectors, result]);

  return (
    <main className="app-shell">
      <aside className="control-panel" aria-label="Generator controls">
        <header className="brand-block">
          <p className="eyebrow">Procedural compiler</p>
          <h1>3D Highway Network Generator</h1>
        </header>

        <section className="panel-section">
          <div className="section-heading">
            <h2>Input Graph</h2>
            <select value={sampleKey} aria-label="Example graph" onChange={(event) => updateSample(event.target.value)}>
              <option value="stack4">4-way stack</option>
              <option value="turbine5">5-way urban hub</option>
              <option value="directional3">3-way directional T</option>
            </select>
          </div>
          <textarea
            value={graphInput}
            spellCheck={false}
            aria-label="Geographic graph JSON"
            onChange={(event) => setGraphInput(event.target.value)}
          />
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => generate()}>
              Generate
            </button>
            <ResetButton />
          </div>
        </section>

        <section className="panel-section compact">
          <h2>Design Controls</h2>
          {CONTROL_DEFS.map((control) => (
            <label key={control.key}>
              {control.label}
              <span>{options[control.key]} m</span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={options[control.key]}
                onChange={(event) => updateOption(control.key, Number(event.target.value))}
              />
            </label>
          ))}
        </section>

        <section className="panel-section">
          <h2>Generated Stores</h2>
          <dl className="stats-list">
            {stats.map(([label, value]) => (
              <div className="stat-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </aside>

      <section className="viewport-shell" aria-label="3D highway scene">
        <SceneView
          result={result}
          visibility={visibility}
          onSelect={setSelectedConnector}
          onRendered={updateRendererDebug}
        />
        <div className="scene-toolbar">
          {([
            ["validation", "Validation"],
            ["structures", "Structures"],
            ["laneGraph", "Lane Graph"]
          ] as const).map(([target, label]) => (
            <button
              key={target}
              type="button"
              aria-pressed={visibility[target]}
              onClick={() => setVisibility((current) => ({ ...current, [target]: !current[target] }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="status-strip">
          <strong className={statusClass}>{statusText}</strong>
          <span>{summary}</span>
        </div>
      </section>

      <aside className="inspector-panel" aria-label="Generated details">
        <section className="panel-section">
          <h2>Selected Connector</h2>
          <SelectionDetails connector={selectedConnector} />
        </section>

        <section className="panel-section">
          <h2>Validation</h2>
          <ul className="issue-list">
            {result.warnings.length === 0 ? (
              <li>No hard collisions, clearance issues, design violations, or operational warnings.</li>
            ) : (
              result.warnings.map((issue, index) => (
                <li className={issue.severity ?? "warning"} key={`${issue.type}-${index}`}>
                  {issue.message}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="panel-section grow">
          <h2>Movements</h2>
          <div className="movement-list">
            {connectors.map((connector) => (
              <button
                className="movement-item"
                type="button"
                key={connector.id}
                onClick={() => setSelectedConnector(connector)}
              >
                <span className="movement-swatch" style={{ background: colorForLayer(connector.layer) }} />
                <span>
                  {connector.movementId.replace("movement:", "")}
                  <br />
                  <small>
                    {connector.turnClass}, layer {connector.layer}, {connector.length.toFixed(0)} m
                  </small>
                </span>
                <span>{connector.crossSection.laneCount}L</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <script id="debugState" type="application/json">
        {JSON.stringify(debugState)}
      </script>
    </main>
  );
}

function ResetButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("highway:reset-camera"))}>
      Reset View
    </button>
  );
}

function SelectionDetails({ connector }: { connector: Connector | null }) {
  if (!connector) {
    return <div className="selection-details muted">Click a ramp in the 3D view.</div>;
  }

  return (
    <div className="selection-details">
      <div>
        <b>ID</b> {connector.id}
      </div>
      <div>
        <b>Movement</b> {connector.movementId}
      </div>
      <div>
        <b>Class</b> {connector.turnClass}
      </div>
      <div>
        <b>Layer</b> {connector.layer} ({connector.targetElevation.toFixed(1)} m band)
      </div>
      <div>
        <b>Length</b> {connector.length.toFixed(0)} m
      </div>
      <div>
        <b>Radius</b> {connector.minRadius.toFixed(0)} m estimated minimum
      </div>
      <div>
        <b>Grade</b> {(connector.maxObservedGrade * 100).toFixed(1)}% maximum observed
      </div>
    </div>
  );
}

function SceneView({
  result,
  visibility,
  onSelect,
  onRendered
}: {
  result: GenerationResult;
  visibility: VisibilityState;
  onSelect: (connector: Connector) => void;
  onRendered: (renderer: HighwayRenderer) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<HighwayRenderer | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const renderer = new HighwayRenderer(hostRef.current, { onSelect });
    rendererRef.current = renderer;
    const resetCamera = () => renderer.resetCamera();
    window.addEventListener("highway:reset-camera", resetCamera);

    return () => {
      window.removeEventListener("highway:reset-camera", resetCamera);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onSelect]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.renderNetwork(result);
    onRendered(renderer);
  }, [onRendered, result]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setVisibility("validation", visibility.validation);
    renderer.setVisibility("structures", visibility.structures);
    renderer.setVisibility("laneGraph", visibility.laneGraph);
  }, [visibility]);

  return <div ref={hostRef} className="scene-host" />;
}
