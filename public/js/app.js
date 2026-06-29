import { init } from "./ui-manager.js?v=10";

// Bootstrap the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
