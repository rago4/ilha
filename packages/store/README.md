# `@ilha/store`

A zustand-shaped reactive store for [Ilha](https://github.com/ilhajs/ilha) islands. Backed by [alien-signals](https://github.com/stackblitz/alien-signals) — the same engine that powers `ilha` core state — for shared global state that lives outside any single island.

---

## Installation

```bash
bun add @ilha/store
```

---

## Quick Start

```ts
import { createStore } from "@ilha/store";

const store = createStore({ count: 0 });

store.setState({ count: 1 });
store.getState(); // → { count: 1 }
```

---

## When to Use

`ilha` state is **island-local** — signals are scoped to a single component instance. Use `@ilha/store` when you need state that is:

- **Shared across multiple islands** — e.g. a cart, auth session, or theme
- **Updated from outside an island** — e.g. from a WebSocket handler or a global event bus
- **Persisted or derived globally** — e.g. synced to `localStorage` via a `subscribe` listener

For state that only one island reads and writes, prefer `ilha`'s built-in `.state()`.

---

## API

### `createStore(initialState, actions?)`

Creates a store. Optionally accepts an actions creator for encapsulating state mutations.

```ts
// State only
const store = createStore({ count: 0, name: "Ada" });

// State + actions
const store = createStore({ count: 0 }, (set, get) => ({
  increment() {
    set({ count: get().count + 1 });
  },
  reset() {
    set({ count: 0 });
  },
}));

store.getState().increment();
store.getState().count; // → 1
```

The actions creator receives:

| Argument                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `set(patch \| updater)` | Merge a partial patch or apply an updater function   |
| `get()`                 | Read the current live state (includes other actions) |
| `getInitialState()`     | Read the frozen initial state snapshot               |

---

### `store.setState(update)`

Merges a partial state update. Accepts a plain object or an updater function.

```ts
store.setState({ count: 5 });
store.setState((s) => ({ count: s.count + 1 }));
```

---

### `store.getState()`

Returns the current state snapshot.

```ts
store.getState(); // → { count: 5 }
```

---

### `store.getInitialState()`

Returns the frozen initial state as it was at construction time.

```ts
store.getInitialState(); // → { count: 0 }
```

---

### `store.subscribe(listener)`

Subscribes to all state changes. The listener receives the next and previous state. Returns an unsubscribe function.

```ts
const unsub = store.subscribe((state, prev) => {
  console.log(state.count, prev.count);
});

unsub(); // stop listening
```

### `store.subscribe(selector, listener)` — slice subscription

Subscribes to a derived slice. The listener only fires when the selected value changes (compared with `Object.is`).

```ts
const unsub = store.subscribe(
  (s) => s.count,
  (count, prev) => console.log("count changed:", prev, "→", count),
);
```

---

### `store.bind(el, render)`

Reactively renders a store-driven HTML string into a DOM element whenever state changes. The render function may return a plain string or an `html\`\`` tagged template.

```ts
import { html } from "@ilha/store";

const unsub = store.bind(
  document.getElementById("counter")!,
  (state) => html`<p>Count: ${state.count}</p>`,
);

unsub(); // detach
```

### `store.bind(el, selector, render)` — slice bind

Only re-renders when the selected slice changes.

```ts
store.bind(
  document.getElementById("badge")!,
  (s) => s.count,
  (count) => html`<span>${count}</span>`,
);
```

---

## Usage with Ilha Islands

The most common pattern is reading the store inside an island's `.effect()` and calling `store.subscribe()` to drive reactive re-renders:

```ts
import { createStore, html } from "@ilha/store";
import ilha from "ilha";

export const cartStore = createStore({ items: [] as string[] }, (set, get) => ({
  add(item: string) {
    set({ items: [...get().items, item] });
  },
  remove(item: string) {
    set({ items: get().items.filter((i) => i !== item) });
  },
}));

export const CartIsland = ilha
  .state("items", cartStore.getState().items)
  .effect(({ state }) => {
    return cartStore.subscribe(
      (s) => s.items,
      (items) => state.items(items),
    );
  })
  .render(
    ({ state }) => html`
      <ul>
        ${state.items().map((item) => html`<li>${item}</li>`)}
      </ul>
    `,
  );
```

---

## TypeScript

Key exported types:

```ts
import type {
  StoreApi, // the store instance interface
  SetState, // (patch | updater) => void
  GetState, // () => T
  Listener, // (state, prevState) => void
  SliceListener, // (slice, prevSlice) => void
  RenderResult, // string | RawHtml
  Unsub, // () => void
} from "@ilha/store";
```

---

## License

MIT
