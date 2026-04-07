import { createSvgDocumentTools } from "./model/svg-document";
import { createSvgGeometryTools } from "./model/svg-geometry";
import { createSvgMetadataTools } from "./model/svg-metadata";
import type { SvgModel, SvgRuntimeStateLike } from "./model/types";

export function createSvgModel(state: SvgRuntimeStateLike): SvgModel {
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
