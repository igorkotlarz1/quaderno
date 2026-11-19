import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { store } from "./lib/store";
import { sync } from "./lib/sync";
import { lexicon } from "./lib/lexicon";

// Load the lessons from IndexedDB first, then start syncing, load the offline dictionary and draw the app.
void store.init().then(() => {
  sync.start();
  void lexicon.start();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
