import "./style.css";
import ilha from "ilha";
import pageRouter from "ilha:pages";
import registry from "ilha:registry";

ilha.mount(registry, { root: document.querySelector("#app")! });
pageRouter.mount("#app");
