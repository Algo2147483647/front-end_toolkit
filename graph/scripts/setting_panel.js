const ExportSvg = window.ExportSvg;

document.getElementById("fileInput").addEventListener("change", handleFile);
document.getElementById("settings-btn").addEventListener("click", toggleSettingsPanel);
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

function toggleSettingsPanel() {
  const panel = document.getElementById("settings-panel");
  const button = document.getElementById("settings-btn");
  const isVisible = panel.classList.toggle("settings-panel-visible");
  button.setAttribute("aria-expanded", String(isVisible));
}
