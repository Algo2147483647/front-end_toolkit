import { SvgStudioShell } from "./components/SvgStudioShell";
import { useSvgStudio } from "./hooks/useSvgStudio";

export default function App() {
  const { refs, workspaceSurfaceProps } = useSvgStudio();

  return <SvgStudioShell refs={refs} workspaceSurfaceProps={workspaceSurfaceProps} />;
}
