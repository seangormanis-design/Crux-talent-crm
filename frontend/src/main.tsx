import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Without this, dragging a file anywhere on the page that isn't precisely
// over a component's own drop zone (CvDropCreatePanel's dashed box, etc.)
// falls through to the browser's default behavior — typically navigating
// the whole tab away to open the raw file — which silently swallows the
// drop before any React onDrop handler ever runs. A page-wide guard means
// a drop zone's own handler is always what decides what happens, even if
// the cursor strays slightly outside its bounds during the drag.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
