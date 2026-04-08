# `@ilha/router`

A lightweight, isomorphic router for [Ilha](https://github.com/ilhajs/ilha) islands. Runs in the browser with full reactivity and on the server as a synchronous HTML string renderer. Pairs natively with [Nitro](https://nitro.build/) and includes a Vite plugin for file-system based routing.

---

## Installation

```bash
bun add @ilha/router
```

---

## Quick Start

### Client-side

```ts
import { router } from "@ilha/router";
import { homePage, aboutPage, userPage, notFound } from "./pages";

router()
  .route("/", homePage)
  .route("/about", aboutPage)
  .route("/user/:id", userPage)
  .route("/**", notFound)
  .mount("#app");
```

### Server-side (SSR)

```ts
import { router } from "@ilha/router";
import { homePage, aboutPage, userPage, notFound } from "./pages";

export default defineEventHandler((event) => {
  const html = router()
    .route("/", homePage)
    .route("/about", aboutPage)
    .route("/user/:id", userPage)
    .route("/**", notFound)
    .render(event.node.req.url ?? "/");

  return new Response(`<!doctype html><html><body>${html}</body></html>`, {
    headers: { "content-type": "text/html" },
  });
});
```

---

## Core API

### `router()`

Creates a new router instance and **resets the route registry**. Always call `router()` fresh — never share instances across server requests.

Returns a `RouterBuilder`.

---

#### `.route(pattern, island)`

Registers a route. Patterns are matched in **declaration order** — first match wins. Uses [rou3](https://github.com/h3js/rou3) for matching, the same engine as Nitro.

| Pattern         | Matches             | `routeParams()`                   |
| --------------- | ------------------- | --------------------------------- |
| `/`             | `/`                 | `{}`                              |
| `/about`        | `/about`            | `{}`                              |
| `/user/:id`     | `/user/42`          | `{ id: "42" }`                    |
| `/:org/:repo`   | `/ilha/router`      | `{ org: "ilha", repo: "router" }` |
| `/docs/**:slug` | `/docs/guide/intro` | `{ slug: "guide/intro" }`         |
| `/**`           | anything            | `{}`                              |

Returns the same `RouterBuilder` for chaining.

---

#### `.mount(target)` — browser only

Mounts the router into a DOM element or CSS selector. Sets up `popstate` listening and intercepts internal `<a>` clicks automatically.

Returns an `unmount` function.

```ts
const unmount = router().route("/", homePage).mount("#app");

// later:
unmount();
```

No-op with a console warning when called outside a browser environment.

---

#### `.render(url)` — server / SSR

Resolves the given URL against the route registry and returns an HTML string. Accepts a path string, full URL string, or `URL` object. Populates all route signals identically to the browser.

```ts
const html = router().route("/", homePage).route("/**", notFound).render("/");
// → '<div data-router-view><p>home</p></div>'
```

---

### `navigate(to, options?)`

Programmatically navigate to a path. Updates the URL, history stack, and all reactive signals.

```ts
import { navigate } from "@ilha/router";

navigate("/about");
navigate("/about", { replace: true }); // replaces instead of pushing
```

No-op on the server.

---

### `useRoute()`

Returns reactive signal accessors for the current route state. Safe to call inside any island render function on both client and server.

```ts
import { useRoute } from "@ilha/router";

const MyPage = ilha.render(() => {
  const { path, params, search, hash } = useRoute();
  return `<p>user id: ${params().id}</p>`;
});
```

---

### `routePath` · `routeParams` · `routeSearch` · `routeHash`

The underlying context signals — use these outside of islands when you need direct signal access.

```ts
import { routePath, routeParams, routeSearch } from "@ilha/router";

routePath(); // → "/user/42"
routeParams(); // → { id: "42" }
routeSearch(); // → "?tab=docs"
```

---

### `isActive(pattern)`

Returns `true` if the current path matches the given registered pattern. Supports static paths and `:param` patterns.

```ts
import { isActive } from "@ilha/router";

isActive("/about"); // → true / false
isActive("/user/:id"); // → true when on any /user/* path
```

---

### `enableLinkInterception(root?)`

Attaches a delegated click listener to `root` (defaults to `document`) that intercepts `<a>` clicks and routes them client-side. Called automatically by `.mount()`.

Skips links that are external, `target="_blank"`, anchor-only (`#hash`), or modified (`Ctrl`/`Meta`/`Shift`).

Returns a cleanup function.

```ts
const stop = enableLinkInterception(myContainer);
stop(); // remove listener
```

No-op on the server.

---

### `RouterView`

The outlet island rendered by `.mount()` and `.render()`. Wraps the active island in `<div data-router-view>`, or renders `<div data-router-empty></div>` when no route matches.

```ts
import { RouterView } from "@ilha/router";

RouterView.toString(); // SSR
RouterView.mount(el); // client
```

---

### `RouterLink`

A declarative link island that calls `navigate()` on click.

```ts
import { RouterLink } from "@ilha/router";

RouterLink.toString({ href: "/about", label: "About" });
// → '<a data-link href="/about">About</a>'
```

---

## File-system Routing

`@ilha/router` includes a Vite plugin that scans `src/pages/`, resolves layout and error boundary chains, and generates a ready-to-use router — no manual route registration needed.

### Setup

```ts
// vite.config.ts
import { pages } from "@ilha/router/vite";

export default defineConfig({
  plugins: [pages()],
});
```

Add `src/generated/` to `.gitignore`.

### Directory structure

```
src/pages/
  +layout.ts           ← root layout (wraps all pages)
  +error.ts            ← root error boundary
  index.ts             → /
  about.ts             → /about
  user/
    +layout.ts         ← nested layout (wraps user/* only)
    +error.ts          ← nested error boundary
    [id].ts            → /user/:id
    [id]/
      settings.ts      → /user/:id/settings
  [...slug].ts         → /**:slug
```

### Filename → pattern mapping

| File              | Pattern       |
| ----------------- | ------------- |
| `index.ts`        | `/`           |
| `about.ts`        | `/about`      |
| `[id].ts`         | `/:id`        |
| `user/[id].ts`    | `/user/:id`   |
| `[org]/[repo].ts` | `/:org/:repo` |
| `[...slug].ts`    | `/**:slug`    |

### Layouts

A `+layout.ts` wraps every page in its directory and all subdirectories. Layouts compose **inside-out** — the nearest layout is innermost, the root layout is outermost.

```ts
// src/pages/+layout.ts
import { html } from "ilha";
import type { LayoutHandler } from "@ilha/router/vite";

export default ((children) =>
  ilha.render(
    () => html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <main>${children}</main>
    `,
  )) satisfies LayoutHandler;
```

### Error boundaries

A `+error.ts` catches any error thrown during rendering of pages in its directory and all subdirectories. The nearest boundary wins. Receives the error and the current route snapshot.

```ts
// src/pages/+error.ts
import type { ErrorHandler } from "@ilha/router/vite";

export default ((error, route) =>
  ilha.render(
    () => `
    <div class="error">
      <h1>${error.status ?? 500}</h1>
      <p>${error.message}</p>
      <p>Path: ${route.path}</p>
    </div>
  `,
  )) satisfies ErrorHandler;
```

### Usage with Nitro

The plugin exposes a virtual module `ilha:pages` that both the Nitro handler and the client entry import — the route config is defined once and shared.

```ts
// routes/[...].ts — Nitro catch-all handler
import pageRouter from "ilha:pages";

export default defineEventHandler((event) => {
  const html = pageRouter.render(event.node.req.url ?? "/");
  return new Response(`<!doctype html><html><body>${html}</body></html>`, {
    headers: { "content-type": "text/html" },
  });
});
```

```ts
// src/client.ts — browser entry
import pageRouter from "ilha:pages";

pageRouter.mount("#app");
```

### Plugin options

```ts
pages({
  dir: "src/pages", // pages directory
  generated: "src/generated/page-routes.ts", // generated file output
});
```

---

## SSR + Hydration

The same route config runs on both sides. Signals (`routePath`, `routeParams`, etc.) are populated identically by `.render(url)` on the server and `.mount()` on the client — islands reading `useRoute()` produce the same output during SSR and after hydration.

```ts
// server: resolves URL → HTML string, no DOM
pageRouter.render("/user/42");
routeParams(); // → { id: "42" }

// client: mounts into DOM, listens for navigation
pageRouter.mount("#app");
navigate("/user/99");
routeParams(); // → { id: "99" }
```

---

## License

MIT
