import {
  createSvgRuntimeState,
  createSvgRuntimeStore
} from "../../../../scripts/runtime-store.js";

export { createSvgRuntimeStore };

export function createSvgStudioState() {
  return createSvgRuntimeState();
}
