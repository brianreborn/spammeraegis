import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app");
}

try {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  root.innerHTML = `<pre style="padding:16px;color:#c45c4a">${String(err)}</pre>`;
}
