import "../../../styles.css";
import "./host.css";

let legacyBootstrapPromise: Promise<unknown> | null = null;

export async function bootstrapLegacySvgStudio() {
  if (!legacyBootstrapPromise) {
    legacyBootstrapPromise = import("../../../scripts/app.js");
  }

  await legacyBootstrapPromise;
}
