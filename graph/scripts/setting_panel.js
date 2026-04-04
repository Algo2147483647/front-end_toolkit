const ExportSvg = window.ExportSvg;
const controls = document.getElementById("floating-controls");
const settingsButton = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");

document.getElementById("fileInput").addEventListener("change", handleFile);
settingsButton.addEventListener("click", toggleSettingsPanel);
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
