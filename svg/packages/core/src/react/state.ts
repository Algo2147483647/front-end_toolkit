import {
  createSvgRuntimeState,
  createSvgRuntimeStore
} from "../runtime/runtime-store";

export { createSvgRuntimeStore };

export function createSvgStudioState() {
  return createSvgRuntimeState();
}
