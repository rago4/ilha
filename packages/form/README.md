# `@ilha/form`

A tiny, typed form binding library for [Ilha](https://github.com/ilhajs/ilha) islands. Binds a [Standard Schema](https://standardschema.dev/) validator to a native `<form>` element — wires up typed submission, per-field error tracking, and dirty state using native DOM events only. No external runtime dependencies.

---

## Installation

```bash
npm install @ilha/form
# or Bun
bun add @ilha/form
```

---

## Quick Start

```ts
import { z } from "zod";
import ilha, { html } from "ilha";
import { createForm, type FormErrors } from "@ilha/form";

const ContactForm = ilha
  .state("errors", {} as FormErrors)
  .effect(({ host, state }) => {
    const form = createForm({
      el: host.querySelector("form")!,
      schema: z.object({
        email: z.string().email(),
        name: z.string().min(1, "Name is required"),
      }),
      onSubmit(values) {
        console.log(values); // fully typed
      },
      onError(issues) {
        state.errors(issuesToErrors(issues));
      },
      validateOn: "change",
    });
    return form.mount();
  })
  .render(
    ({ state }) => html`
      <form>
        <input name="email" type="email" />
        <input name="name" />
        <button type="submit">Submit</button>
      </form>
    `,
  );
```

---

## How It Works

`createForm()` binds a Standard Schema to a `<form>` element using native DOM event listeners. On submission it reads all field values via `FormData`, runs them through the schema synchronously, and either calls `onSubmit` with fully typed output or `onError` with structured validation issues. Call `form.mount()` to activate the listeners and `form.unmount()` (or the returned cleanup function) to remove them.

> **Note:** Async schema validation is not supported. Use a schema library with synchronous validation (Zod, Valibot, ArkType all support this).

---

## API

### `createForm(options)`

Creates a form binding instance. Does not attach any listeners until `.mount()` is called.

```ts
const form = createForm({
  el: document.querySelector("form")!,
  schema: mySchema,
  onSubmit(values, event) {
    /* … */
  },
  onError(issues, event) {
    /* … */
  },
  validateOn: "change", // default: "submit"
});
```

**Options:**

| Option       | Type                              | Required | Description                                         |
| ------------ | --------------------------------- | -------- | --------------------------------------------------- |
| `el`         | `HTMLFormElement`                 | ✓        | The form element to bind to                         |
| `schema`     | `StandardSchemaV1`                | ✓        | Any Standard Schema compatible validator            |
| `onSubmit`   | `(values, event) => void`         | ✓        | Called with typed output on valid submission        |
| `onError`    | `(issues, event) => void`         |          | Called with structured issues on invalid submission |
| `validateOn` | `"submit" \| "change" \| "input"` |          | When to run live validation (default: `"submit"`)   |

**`validateOn` behaviour:**

| Value      | Validates on                                                |
| ---------- | ----------------------------------------------------------- |
| `"submit"` | Form submission only (default)                              |
| `"change"` | `change` event — after a field loses focus with a new value |
| `"input"`  | `input` event — on every keystroke                          |

---

### `form.mount()`

Attaches event listeners to the form. Returns a cleanup function — equivalent to calling `form.unmount()`.

```ts
const unmount = form.mount();

// later:
unmount();
```

---

### `form.unmount()`

Removes all event listeners. Idempotent — safe to call multiple times.

---

### `form.values()`

Reads and validates the current form values synchronously. Returns a discriminated union — never throws.

```ts
const result = form.values();

if (result.ok) {
  console.log(result.data); // typed output
} else {
  console.log(result.issues); // validation issues
}
```

Can be called before `mount()`.

---

### `form.errors()`

Returns the per-field error map from the last validation run. Empty object before the first validation. Returns a copy — mutations do not affect internal state.

```ts
form.errors();
// → { email: ["Invalid email"], name: ["Name is required"] }
```

Error keys are dot-separated field paths matching the schema's issue path (e.g. `"user.email"`). Multiple failing rules on a single field are all surfaced as an array.

---

### `form.isDirty()`

Returns `true` if any field value has changed since `mount()` was called (detected via `change` events). Stays `true` after `unmount()`.

```ts
form.isDirty(); // → false (on mount)
// → true  (after any field change)
```

---

### `form.submit()`

Programmatically triggers the validate → `onSubmit`/`onError` cycle. When mounted, dispatches a real `SubmitEvent` on the form element. When not mounted, runs validation directly.

```ts
form.submit(); // same as the user pressing the submit button
```

---

## TypeScript Types

```ts
import type {
  FormResult, // { ok: true; data: T } | { ok: false; issues: … }
  FormErrors, // Record<string, string[]>
  ValidateOn, // "submit" | "change" | "input"
  Form, // the instance returned by createForm()
  CreateFormOptions,
} from "@ilha/form";
```

---

## Usage with Ilha Islands

`createForm` fits naturally into an island `.effect()` — the form is created after mount, and the returned cleanup is handled automatically by the effect lifecycle:

```ts
ilha
  .state("errors", {} as FormErrors)
  .state("submitted", false)
  .effect(({ host, state }) => {
    const form = createForm({
      el: host.querySelector("form")!,
      schema: z.object({
        email: z.string().email(),
      }),
      onSubmit() {
        state.submitted(true);
      },
      onError(issues) {
        state.errors(issuesToErrors(issues));
      },
      validateOn: "input",
    });
    return form.mount(); // cleanup is called automatically on island unmount
  })
  .render(({ state }) => {
    if (state.submitted()) return html`<p>Thanks!</p>`;
    return html`
      <form>
        <input name="email" type="email" />
        ${state.errors().email ? html`<span>${state.errors().email}</span>` : ""}
        <button>Subscribe</button>
      </form>
    `;
  });
```

---

## License

MIT
