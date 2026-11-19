import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { store } from "./lib/store";
import { sync } from "./lib/sync";

// Load the lessons from IndexedDB first, then start syncing and draw the app.
void store.init().then(() => {
  sync.start();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
