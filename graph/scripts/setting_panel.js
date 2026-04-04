const ExportSvg = window.ExportSvg;
const ZoomGraphIn = window.ZoomGraphIn;
const ZoomGraphOut = window.ZoomGraphOut;
const FitGraphToViewport = window.FitGraphToViewport;
const SetGraphZoomPercent = window.SetGraphZoomPercent;
const controls = document.getElementById("floating-controls");
const settingsButton = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const zoomValueInput = document.getElementById("zoom-value-input");
const graphContainer = document.getElementById("main-content");
const panState = {
  isActive: false,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
};

document.getElementById("fileInput").addEventListener("change", handleFile);
settingsButton.addEventListener("click", toggleSettingsPanel);
document.getElementById("zoom-in-btn").addEventListener("click", ZoomGraphIn);
document.getElementById("zoom-out-btn").addEventListener("click", ZoomGraphOut);
document.getElementById("zoom-fit-btn").addEventListener("click", FitGraphToViewport);
zoomValueInput.addEventListener("change", commitZoomValueInput);
zoomValueInput.addEventListener("blur", commitZoomValueInput);
zoomValueInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitZoomValueInput();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    zoomValueInput.blur();
  }
});
graphContainer.addEventListener("mousedown", event => {
  if (event.button !== 2 || !graphContainer.classList.contains("is-ready")) {
    return;
  }

  event.preventDefault();
  panState.isActive = true;
  panState.startX = event.clientX;
  panState.startY = event.clientY;
  panState.scrollLeft = graphContainer.scrollLeft;
  panState.scrollTop = graphContainer.scrollTop;
  document.body.classList.add("graph-is-panning");
});
graphContainer.addEventListener("contextmenu", event => {
  if (graphContainer.classList.contains("is-ready")) {
    event.preventDefault();
  }
});
document.addEventListener("mousemove", event => {
  if (!panState.isActive) {
    return;
  }

  const deltaX = event.clientX - panState.startX;
  const deltaY = event.clientY - panState.startY;
  graphContainer.scrollLeft = panState.scrollLeft - deltaX;
  graphContainer.scrollTop = panState.scrollTop - deltaY;
});
document.addEventListener("mouseup", event => {
  if (event.button === 2) {
    stopGraphPan();
  }
});
window.addEventListener("blur", stopGraphPan);
document.getElementById("export-btn").addEventListener("click", () => {
  const svgElement = document.querySelector("#main-content svg");
  if (svgElement) {
    ExportSvg(svgElement);
  } else {
    window.SetGraphMessage("Render a DAG first, then export the SVG.");
  }
});
document.getElementById("back-btn").addEventListener("click", () => {
  window.NavigateBack();
});
document.addEventListener("click", event => {
  if (!controls.contains(event.target)) {
    setSettingsPanelVisibility(false);
  }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    setSettingsPanelVisibility(false);
  }
});

function toggleSettingsPanel() {
  setSettingsPanelVisibility(!settingsPanel.classList.contains("settings-panel-visible"));
}

function setSettingsPanelVisibility(isVisible) {
  settingsPanel.classList.toggle("settings-panel-visible", isVisible);
  settingsButton.setAttribute("aria-expanded", String(isVisible));
}

function commitZoomValueInput() {
  SetGraphZoomPercent(zoomValueInput.value, true);
}

function stopGraphPan() {
  if (!panState.isActive) {
    return;
  }

  panState.isActive = false;
  document.body.classList.remove("graph-is-panning");
}
