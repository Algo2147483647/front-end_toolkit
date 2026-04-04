import { createSvgDocumentTools } from "./model/svg-document.js";
import { createSvgGeometryTools } from "./model/svg-geometry.js";
import { createSvgMetadataTools } from "./model/svg-metadata.js";

export function createSvgModel(state) {
  const metadataTools = createSvgMetadataTools(state);
  const geometryTools = createSvgGeometryTools({
    state,
    isNodeLocked: metadataTools.isNodeLocked
  });
  const documentTools = createSvgDocumentTools(state);

  return {
    ...documentTools,
    ...metadataTools,
    ...geometryTools
  };
}
