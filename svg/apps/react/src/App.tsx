import { SvgStudioShell } from "./components/SvgStudioShell";
import { useSvgStudio } from "./hooks/useSvgStudio";

export default function App() {
  const refs = useSvgStudio();

  return <SvgStudioShell refs={refs} />;
}
