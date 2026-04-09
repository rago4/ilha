import "./style.css";
import { mount } from "ilha";
import { pageRouter } from "ilha:pages";
import { registry } from "ilha:registry";

// Prime route signals FIRST — so that islands hydrated by ilha.mount() see
// the correct route values (routePath, routeParams, etc.) on their first
// render.  Without this, signals start at their defaults ("", {}, …) and
// the layout island re-renders when syncRoute() later sets the real values,
// morphing over the already-hydrated DOM and destroying bindings/listeners.
pageRouter.prime();

// ilha.mount SECOND — finds [data-ilha] in SSR HTML and attaches reactivity.
// Because route signals are already primed, the layout's first render
// produces output identical to the SSR HTML → morph is a no-op.
mount(registry, { root: document.querySelector("#app")! });

// router THIRD — wires up popstate + link interception.  With hydrate: true
// it skips mounting RouterView (the SSR content is already live) and defers
// to a sentinel that hands off to RouterView on the first real navigation.
pageRouter.mount("#app", { hydrate: true });
