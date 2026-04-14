export function supportsFileAccessApi(): boolean {
  return typeof window.showOpenFilePicker === "function";
}
