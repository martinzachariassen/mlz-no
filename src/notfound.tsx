import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NotFound } from "./components/NotFound";
import "./styles/index.css";

// Entry for 404.html (see vite.config.ts rollupOptions.input). Mirrors main.tsx
// but mounts the NotFound page instead of the home page.
const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <NotFound />
  </StrictMode>,
);
