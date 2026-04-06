import { useEffect } from "react";
import { bootstrapLegacySvgStudio, svgStudioShellHtml } from "@core";

export default function App() {
  useEffect(() => {
    void bootstrapLegacySvgStudio();
  }, []);

  return (
    <div
      className="svg-studio-app-host"
      dangerouslySetInnerHTML={{ __html: svgStudioShellHtml }}
    />
  );
}
