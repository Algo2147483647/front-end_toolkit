import { DEFAULT_OPTIONS, SAMPLE_GRAPHS, generateHighwayNetwork } from "./generator.js";
import { HighwayRenderer } from "./render.js";

const elements = {
  sampleSelect: document.querySelector("#sampleSelect"),
  graphInput: document.querySelector("#graphInput"),
  generateButton: document.querySelector("#generateButton"),
  resetCameraButton: document.querySelector("#resetCameraButton"),
  sceneHost: document.querySelector("#sceneHost"),
  statusText: document.querySelector("#statusText"),
  summaryText: document.querySelector("#summaryText"),
  statsList: document.querySelector("#statsList"),
  validationList: document.querySelector("#validationList"),
  movementList: document.querySelector("#movementList"),
  selectionDetails: document.querySelector("#selectionDetails"),
  toggleValidationButton: document.querySelector("#toggleValidationButton"),
  toggleStructuresButton: document.querySelector("#toggleStructuresButton"),
  toggleLanesButton: document.querySelector("#toggleLanesButton"),
  portalDistance: document.querySelector("#portalDistance"),
  layerHeight: document.querySelector("#layerHeight"),
  runout: document.querySelector("#runout"),
  minRadius: document.querySelector("#minRadius"),
  portalDistanceValue: document.querySelector("#portalDistanceValue"),
  layerHeightValue: document.querySelector("#layerHeightValue"),
  runoutValue: document.querySelector("#runoutValue"),
  minRadiusValue: document.querySelector("#minRadiusValue")
};

let lastResult = null;

const renderer = new HighwayRenderer(elements.sceneHost, {
  onSelect: (connector) => renderSelection(connector)
});

initialize();

function initialize() {
  elements.portalDistance.value = DEFAULT_OPTIONS.portalDistance;
  elements.layerHeight.value = DEFAULT_OPTIONS.layerHeight;
  elements.runout.value = DEFAULT_OPTIONS.runout;
  elements.minRadius.value = DEFAULT_OPTIONS.minRadius;

  for (const input of [elements.portalDistance, elements.layerHeight, elements.runout, elements.minRadius]) {
    input.addEventListener("input", () => {
      syncControlLabels();
      generate();
    });
  }

  elements.sampleSelect.addEventListener("change", () => {
    elements.graphInput.value = formatGraph(SAMPLE_GRAPHS[elements.sampleSelect.value]);
    generate();
  });
  elements.generateButton.addEventListener("click", generate);
  elements.resetCameraButton.addEventListener("click", () => renderer.resetCamera());
  setupToggle(elements.toggleValidationButton, "validation");
  setupToggle(elements.toggleStructuresButton, "structures");
  setupToggle(elements.toggleLanesButton, "laneGraph");

  elements.graphInput.value = formatGraph(SAMPLE_GRAPHS.stack4);
  syncControlLabels();
  generate();
}

function generate() {
  try {
    const graph = JSON.parse(elements.graphInput.value);
    const options = readOptions();
    lastResult = generateHighwayNetwork(graph, options);
    renderer.renderNetwork(lastResult);
    renderStats(lastResult);
    renderValidation(lastResult);
    renderMovements(lastResult);
    renderSelection(null);
    updateStatus(lastResult);
    writeDebugState(lastResult);
  } catch (error) {
    elements.statusText.textContent = "Input Error";
    elements.statusText.className = "infeasible";
    elements.summaryText.textContent = error.message;
  }
}

function writeDebugState(result) {
  const connectors = result.network.interchanges.flatMap((item) => item.connectors);
  document.querySelector("#debugState").textContent = JSON.stringify({
    status: result.status,
    interchanges: result.network.interchanges.length,
    connectors: connectors.length,
    conflicts: result.network.interchanges.reduce((sum, item) => sum + item.conflicts.length, 0),
    structures: result.network.structures.length,
    layers: [...new Set(connectors.map((connector) => connector.layer))],
    sceneObjects: renderer.countSceneObjects(),
    canvasPixels: renderer.sampleCanvasPixels()
  });
}

function readOptions() {
  return {
    portalDistance: Number(elements.portalDistance.value),
    layerHeight: Number(elements.layerHeight.value),
    runout: Number(elements.runout.value),
    minRadius: Number(elements.minRadius.value)
  };
}

function syncControlLabels() {
  elements.portalDistanceValue.value = elements.portalDistance.value;
  elements.layerHeightValue.value = elements.layerHeight.value;
  elements.runoutValue.value = elements.runout.value;
  elements.minRadiusValue.value = elements.minRadius.value;
}

function updateStatus(result) {
  const statusLabels = {
    valid: "Valid",
    "valid-with-warnings": "Valid With Warnings",
    infeasible: "Infeasible"
  };
  elements.statusText.textContent = statusLabels[result.status] ?? result.status;
  elements.statusText.className = result.status === "valid"
    ? ""
    : result.status === "valid-with-warnings"
      ? "warning"
      : "infeasible";
  const connectorCount = result.network.interchanges.reduce((sum, item) => sum + item.connectors.length, 0);
  const conflictCount = result.network.interchanges.reduce((sum, item) => sum + item.conflicts.length, 0);
  elements.summaryText.textContent = `${connectorCount} connector ramps, ${conflictCount} plan-view conflicts, cost ${result.cost.toLocaleString()}.`;
}

function renderStats(result) {
  const network = result.network;
  const connectors = network.interchanges.flatMap((interchange) => interchange.connectors);
  const layers = new Set(connectors.map((connector) => connector.layer));
  const rows = [
    ["Geo nodes", network.geoGraph.nodes.length],
    ["Half-edges", network.halfEdges.length],
    ["Interchanges", network.interchanges.length],
    ["Movements", network.interchanges.reduce((sum, item) => sum + item.movements.length, 0)],
    ["Lane nodes", network.laneGraph.nodes.length],
    ["Lane edges", network.laneGraph.edges.length],
    ["Vertical layers", layers.size],
    ["Structures", network.structures.length]
  ];
  elements.statsList.innerHTML = rows
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join("");
}

function renderValidation(result) {
  const issues = result.warnings;
  if (!issues.length) {
    elements.validationList.innerHTML = `<li>No hard collisions, clearance issues, design violations, or operational warnings.</li>`;
    return;
  }
  elements.validationList.innerHTML = issues
    .map((issue) => `<li class="${issue.severity ?? "warning"}">${escapeHtml(issue.message)}</li>`)
    .join("");
}

function renderMovements(result) {
  const connectors = result.network.interchanges.flatMap((interchange) => interchange.connectors);
  elements.movementList.innerHTML = connectors
    .map((connector) => `
      <button class="movement-item" type="button" data-connector-id="${connector.id}">
        <span class="movement-swatch" style="background:${colorForLayer(connector.layer)}"></span>
        <span>
          ${escapeHtml(connector.movementId.replace("movement:", ""))}
          <br />
          <small>${connector.turnClass}, layer ${connector.layer}, ${connector.length.toFixed(0)} m</small>
        </span>
        <span>${connector.crossSection.laneCount}L</span>
      </button>
    `)
    .join("");

  elements.movementList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const connector = connectors.find((item) => item.id === button.dataset.connectorId);
      renderSelection(connector);
    });
  });
}

function renderSelection(connector) {
  if (!connector) {
    elements.selectionDetails.textContent = "Click a ramp in the 3D view.";
    elements.selectionDetails.classList.add("muted");
    return;
  }
  elements.selectionDetails.classList.remove("muted");
  elements.selectionDetails.innerHTML = `
    <div><b>ID</b> ${escapeHtml(connector.id)}</div>
    <div><b>Movement</b> ${escapeHtml(connector.movementId)}</div>
    <div><b>Class</b> ${connector.turnClass}</div>
    <div><b>Layer</b> ${connector.layer} (${connector.targetElevation.toFixed(1)} m band)</div>
    <div><b>Length</b> ${connector.length.toFixed(0)} m</div>
    <div><b>Radius</b> ${connector.minRadius.toFixed(0)} m estimated minimum</div>
    <div><b>Grade</b> ${(connector.maxObservedGrade * 100).toFixed(1)}% maximum observed</div>
  `;
}

function setupToggle(button, groupName) {
  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(next));
    renderer.setVisibility(groupName, next);
  });
}

function colorForLayer(layer) {
  if (layer === 0) return "#46515a";
  const colors = ["#59c2a6", "#f0b35a", "#8ad8ff", "#db7fb6", "#9cc66f", "#c6a6ff"];
  return colors[Math.abs(layer) % colors.length];
}

function formatGraph(graph) {
  return JSON.stringify(graph, null, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
