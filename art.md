I've been building for the web for years. Svelte, Vite, Nitro - these tools shaped how I think about UI, and they gave me a lot. At some point I wanted to give something back.

Over the last six months, I quietly built a handful of library prototypes. Each one solved a small problem. At some point the dots started connecting into something larger - and **Ilha** was born.

---

## What is Ilha?

**Ilha** is a tiny, isomorphic UI library built around the [islands architecture](https://www.patterns.dev/vanilla/islands-architecture/). The idea is simple: ship minimal JavaScript, hydrate only what matters.

Here's what it looks like in practice:

```ts
import ilha, { html, mount } from "ilha";

const counter = ilha
  .state("count", 0)
  .derived("doubled", ({ state }) => state.count() * 2)
  .on("[data-action=increase]@click", ({ state }) => {
    state.count(state.count() + 1);
  })
  .bind("#count", "count")
  .effect(({ state }) => {
    if (state.count() > 3) state.count(0);
  })
  .render(
    ({ state, derived }) => html`
      <p>Count: ${state.count()}</p>
      <p>Doubled: ${derived.doubled.value}</p>
      <label for="count">Current count</label>
      <input id="count" type="number" />
      <button data-action="increase">Increase</button>
    `,
  );

mount({ counter });
```

_One island - state, derived values, two-way binding, a side effect, and a render. That's the full API surface, right there._

If you've used Svelte, this will feel familiar. That's intentional - I designed the API around years of experience with Svelte's mental model, but without the compiler step.

---

## Why Build Another UI Library?

Fair question. The honest answer: I wasn't trying to.

I was building prototypes for specific problems - SSR hydration without framework lock-in, reactive state without a virtual DOM, form handling with schema validation. Each one was small. Each one worked well. One day I looked at them together and realized they were already a coherent library.

The constraint I kept hitting with existing tools was the **all-or-nothing problem**. Most modern frameworks want to own your entire render pipeline. If you have an existing backend - a Nitro server, a Hono app, a plain Node server - plugging in a full framework is heavy and opinionated. I wanted something I could _drop in_, not migrate to.

---

## What Makes Ilha Different

### ~1,500 Lines of Code - Total

The entire core codebase is around 1,500 lines. That's not a selling point for minimalism's sake - it has real consequences:

- You can read the whole thing in an afternoon
- You can audit it with confidence
- You can fork it without fear
- It fits entirely inside an AI prompt context window - ask your AI to read the source, understand it fully, and help you extend it

Most UI libraries are black boxes by necessity. Ilha doesn't have to be.

### Signal-Based Reactivity - No Virtual DOM, No Compiler

Reactivity in Ilha is fine-grained and signal-based. When state changes, only the exact DOM nodes that depend on it update. No diffing. No re-rendering entire component trees. No compiler transforming your code at build time.

It just works - in the browser, on the server, at the edge.

### Universal Rendering

Ilha renders anywhere:

- **Client-side** - mount islands into any HTML page
- **Server-side** - render to HTML string, ship to the client, hydrate with zero flicker
- **Edge** - works in any environment that runs modern JS

### Backend Agnostic - With First-Class Templates

Ilha doesn't care what your backend is. Three official starter templates are available today:

| Template | Command                                           | Sandbox                                                                     |
| -------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Vite     | `npx giget@latest gh:ilhajs/ilha/templates/vite`  | [Open](https://stackblitz.com/github/ilhajs/ilha/tree/main/templates/vite)  |
| Hono     | `npx giget@latest gh:ilhajs/ilha/templates/hono`  | [Open](https://stackblitz.com/github/ilhajs/ilha/tree/main/templates/hono)  |
| Nitro    | `npx giget@latest gh:ilhajs/ilha/templates/nitro` | [Open](https://stackblitz.com/github/ilhajs/ilha/tree/main/templates/nitro) |

Or open any of them instantly in StackBlitz - no local setup needed.

### A Full Ecosystem in a Tiny Footprint

Ilha ships with four packages:

- **`ilha`** - core island builder: state, events, SSR, hydration
- **`@ilha/router`** - isomorphic SPA router with a Vite file-system routing plugin
- **`@ilha/store`** - zustand-shaped global state backed by the same signal engine
- **`@ilha/form`** - typed form binding via Standard Schema, with per-field validation and dirty state

One coherent stack. No bloat.

---

## A Real-World Example

Here's a Pokédex built with Ilha - async derived state, slots for composing islands, shared context across islands, and typed inputs:

```ts
import ilha, { html, mount, context, type } from "ilha";

type Pokemon = {
  name: string;
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: { front_default: string };
  types: { type: { name: string } }[];
};

// Shared context - changing this in the picker re-fetches in the card automatically
const pokemon = context("pokemon", "charizard");

const pokemonPicker = ilha
  .state("pokemonList", [])
  .onMount(({ state }) => {
    const fetchList = async () => {
      const req = await fetch("https://pokeapi.co/api/v2/pokemon");
      const list = await req.json();
      state.pokemonList(list.results);
    };
    fetchList();
  })
  .bind("#pokemon", pokemon)
  .render(({ state }) => {
    const options = state
      .pokemonList()
      .map(({ name }) => html`<option value="${name}">${name}</option>`);
    return html`
      <label for="pokemon">Pick a Pokemon</label>
      <select id="pokemon">
        ${options}
      </select>
    `;
  });

const pokemonStats = ilha
  .input(type<{ stats: { key: string; value: number }[] }>())
  .render(({ input }) => {
    const stats = input.stats.map(
      ({ key, value }) => html`
        <tr>
          <td>${key}</td>
          <td>${value}</td>
        </tr>
      `,
    );
    return html`
      <table>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${stats}
        </tbody>
      </table>
    `;
  });

const pokemonCard = ilha
  .derived("pokemonData", async (): Promise<Pokemon> => {
    const req = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon()}`);
    return await req.json();
  })
  .slot("stats", pokemonStats)
  .render(({ derived, slots }) => {
    if (derived.pokemonData.loading) return html`<p>Loading Pokémon...</p>`;
    if (derived.pokemonData.error) return html`<p>${derived.pokemonData.error.message}</p>`;

    const { name, sprites, types, stats } = derived.pokemonData.value!;
    const typesBadges = types.map(({ type }) => html`<span class="badge">${type.name}</span>`);
    const mappedStats = stats.map((e) => ({ key: e.stat.name, value: e.base_stat }));

    return html`
      <img src="${sprites.front_default}" />
      <h2>${name}</h2>
      ${typesBadges} ${slots.stats({ stats: mappedStats })}
    `;
  });

const pokedex = ilha
  .slot("picker", pokemonPicker)
  .slot("card", pokemonCard)
  .render(({ slots }) => html`${slots.picker()} ${slots.card()}`);

mount({ pokedex });
```

Notice what's happening here:

- `context()` creates a reactive value shared across islands - the picker writes it, the card reacts to it automatically
- `derived()` supports async with built-in `loading` / `error` / `value` states - no boilerplate
- `slot()` lets you compose islands into each other with typed inputs
- The whole thing is plain TypeScript - no compiler, no magic, no ceremony

---

## Who Is This For?

Ilha is a good fit if you:

- Want Svelte's mental model without a compiler dependency
- Have an existing backend (Nitro, Hono, Express, anything) and need a lightweight UI layer
- Are building a content-heavy site where full hydration is wasteful
- Want to actually understand your UI library end-to-end
- Are building AI-assisted apps where having the entire source readable by your AI matters

It's probably _not_ the right fit if you need a full SPA framework with a large ecosystem, mature tooling, and years of production hardening - SvelteKit, Nuxt, or Next are better choices there.

---

## Getting Started

Install it:

```sh
npm install ilha
# or
bun add ilha
```

Or scaffold a full project in seconds:

```sh
# Vite
npx giget@latest gh:ilhajs/ilha/templates/vite

# Hono
npx giget@latest gh:ilhajs/ilha/templates/hono

# Nitro
npx giget@latest gh:ilhajs/ilha/templates/nitro
```

The best place to start is the interactive tutorial: [ilha.build/tutorial](https://ilha.build/tutorial)

---

## What's Next

Ilha is in **alpha** today. The core API is stable enough to build real things with, but expect rough edges. The roadmap includes more templates, deeper SSR ergonomics, and expanded documentation.

The best way to follow progress and shape what comes next:

- 🚀 Start learning with [the interactive tutorial](https://ilha.build/tutorial)
- 🐦 Follow [@ilha_js](https://x.com/ilha_js) on X
- 💬 Join the Discord: [discord.gg/WnVTMCTz74](https://discord.gg/WnVTMCTz74)
- ⭐ Star [the repo](https://github.com/ilhajs/ilha) and open issues freely - early feedback is invaluable

Ilha is fully open-source under the MIT license. Come build with us.

👉 **[ilha.build](https://ilha.build)**
