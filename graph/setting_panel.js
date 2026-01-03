document.getElementById("fileInput").addEventListener("change", handleFile);
document.getElementById("settings-btn").addEventListener("click", toggleSettingsPanel);

function toggleSettingsPanel() {
  const panel = document.getElementById("settings-panel");
  panel.classList.toggle("settings-panel-visible");
}

// 点击设置面板外的区域关闭面板
document.addEventListener('click', function(event) {
  const settingsBtn = document.getElementById("settings-btn");
  const settingsPanel = document.getElementById("settings-panel");

  if (!settingsBtn.contains(event.target) && !settingsPanel.contains(event.target)) {
    settingsPanel.classList.remove("settings-panel-visible");
  }
});