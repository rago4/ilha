import "./app.css";
import "basecoat-css/all";
import "shedit/editor.css";
import { setupTheme } from "$lib/theme";
import { pageRouter } from "ilha:pages";

pageRouter.mount("#app");

document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
});
