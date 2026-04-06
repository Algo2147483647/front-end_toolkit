import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");

if (!container) {
  throw new Error("React root container was not found.");
}

createRoot(container).render(<App />);
