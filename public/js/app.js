import { init } from "./ui-manager.js";

// Bootstrap the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
