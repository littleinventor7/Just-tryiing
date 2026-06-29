globalThis.window = {
  addEventListener: () => {}
};
globalThis.document = {
  readyState: "complete",
  documentElement: {
    classList: {
      toggle: () => {},
      add: () => {},
      remove: () => {}
    }
  },
  addEventListener: () => {},
  getElementById: () => ({
    addEventListener: () => {},
    remove: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} }
  }),
  querySelectorAll: () => []
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
globalThis.Blob = class {};
globalThis.URL = {
  createObjectURL: () => "",
  revokeObjectURL: () => ""
};

import("../public/js/ui-manager.js")
  .then((mod) => {
    console.log("SUCCESSFULLY LOADED UI-MANAGER");
    try {
      mod.init();
      console.log("SUCCESSFULLY RAN INIT()");
    } catch (e) {
      console.error("INIT() ERROR:", e);
    }
  })
  .catch(err => console.error("LOAD ERROR:", err));
