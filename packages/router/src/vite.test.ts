import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ilha from "ilha";

import { routePath, routeParams } from "./index";
import {
  wrapLayout,
  wrapError,
  pages,
  type LayoutHandler,
  type ErrorHandler,
  type AppError,
  type RouteSnapshot,
} from "./vite";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function makeDir(suffix: string): Promise<string> {
  const dir = join(tmpdir(), `ilha-pages-test-${suffix}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writePage(dir: string, rel: string, content: string): Promise<void> {
  const full = join(dir, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content, "utf8");
}

async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

// Minimal island factories
const make = (content: string) => ilha.render(() => content);

// ─────────────────────────────────────────────
// wrapLayout()
// ─────────────────────────────────────────────

describe("wrapLayout()", () => {
  it("wraps page island with layout", () => {
    const page: LayoutHandler = (children) =>
      ilha.render(() => `<layout>${children.toString()}</layout>`);
    const inner = make(`<p>content</p>`);
    const wrapped = wrapLayout(page, inner);
    expect(wrapped.toString()).toContain("<layout>");
    expect(wrapped.toString()).toContain("<p>content</p>");
  });

  it("nested layouts compose correctly — inner layout is innermost", () => {
    const rootLayout: LayoutHandler = (children) =>
      ilha.render(() => `<root>${children.toString()}</root>`);
    const userLayout: LayoutHandler = (children) =>
      ilha.render(() => `<user>${children.toString()}</user>`);
    const page = make(`<p>page</p>`);

    // simulate codegen: inner first, then outer
    const wrapped = wrapLayout(rootLayout, wrapLayout(userLayout, page));
    const html = wrapped.toString();

    expect(html).toContain("<root>");
    expect(html).toContain("<user>");
    expect(html).toContain("<p>page</p>");
    // root is outermost
    expect(html.indexOf("<root>")).toBeLessThan(html.indexOf("<user>"));
    expect(html.indexOf("<user>")).toBeLessThan(html.indexOf("<p>page</p>"));
  });

  it("returns an island with .toString and .mount", () => {
    const layout: LayoutHandler = (children) => ilha.render(() => children.toString());
    const wrapped = wrapLayout(layout, make("hi"));
    expect(typeof wrapped.toString).toBe("function");
    expect(typeof wrapped.mount).toBe("function");
  });
});

// ─────────────────────────────────────────────
// wrapError()
// ─────────────────────────────────────────────

describe("wrapError()", () => {
  it("renders page normally when no error is thrown", () => {
    const handler: ErrorHandler = () => make(`<p>error</p>`);
    const page = make(`<p>ok</p>`);
    const wrapped = wrapError(handler, page);
    expect(wrapped.toString()).toContain("<p>ok</p>");
    expect(wrapped.toString()).not.toContain("<p>error</p>");
  });

  it("renders error island when page throws", () => {
    const handler: ErrorHandler = (err) => make(`<p>caught:${err.message}</p>`);
    const page = ilha.render(() => {
      throw new Error("boom");
    });
    const wrapped = wrapError(handler, page);
    expect(wrapped.toString()).toContain("caught:boom");
  });

  it("passes error.message, error.status, error.stack to handler", () => {
    let captured: AppError | null = null;
    const handler: ErrorHandler = (err) => {
      captured = err;
      return make("");
    };
    const page = ilha.render(() => {
      const e: any = new Error("fail");
      e.status = 500;
      throw e;
    });
    wrapError(handler, page).toString();
    expect(captured!.message).toBe("fail");
    expect(captured!.status).toBe(500);
    expect(typeof captured!.stack).toBe("string");
  });

  it("passes current route snapshot to handler", () => {
    let snapshot: RouteSnapshot | null = null;
    const handler: ErrorHandler = (_, route) => {
      snapshot = route;
      return make("");
    };
    const page = ilha.render(() => {
      throw new Error("x");
    });

    // seed signals
    routePath("/user/7");
    routeParams({ id: "7" });

    wrapError(handler, page).toString();
    expect(snapshot!.path).toBe("/user/7");
    expect(snapshot!.params).toEqual({ id: "7" });
  });

  it("nearest error boundary is innermost — outer boundary not called when inner catches", () => {
    let outerCalled = false;
    const outer: ErrorHandler = () => {
      outerCalled = true;
      return make("outer");
    };
    const inner: ErrorHandler = () => make("inner-caught");
    const page = ilha.render(() => {
      throw new Error("e");
    });

    const wrapped = wrapError(outer, wrapError(inner, page));
    const html = wrapped.toString();

    expect(html).toContain("inner-caught");
    expect(outerCalled).toBe(false);
  });

  it("falls back to outer boundary if inner re-throws", () => {
    const outer: ErrorHandler = () => make("outer-caught");
    const inner: ErrorHandler = (err) =>
      ilha.render(() => {
        throw err;
      });
    const page = ilha.render(() => {
      throw new Error("e");
    });

    const wrapped = wrapError(outer, wrapError(inner, page));
    expect(wrapped.toString()).toContain("outer-caught");
  });

  it("returns an island with .toString and .mount", () => {
    const wrapped = wrapError(() => make(""), make("hi"));
    expect(typeof wrapped.toString).toBe("function");
    expect(typeof wrapped.mount).toBe("function");
  });
});

// ─────────────────────────────────────────────
// codegen — via Vite plugin internals
// We test codegen by calling the plugin's buildStart hook
// against a real tmp filesystem and asserting the generated file.
// ─────────────────────────────────────────────

describe("codegen — generated file", () => {
  let pagesDir: string;
  let outFile: string;
  let root: string;

  beforeEach(async () => {
    root = await makeDir("root");
    pagesDir = join(root, "src/pages");
    outFile = join(root, "src/generated/page-routes.ts");
    await mkdir(pagesDir, { recursive: true });
  });

  afterEach(async () => {
    await removeDir(root);
  });

  async function runCodegen() {
    const plugin = pages({ dir: pagesDir, generated: outFile }) as any;
    plugin.configResolved({ root });
    await plugin.buildStart();
    return readFile(outFile, "utf8");
  }

  it("generates a file with the @generated header", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain("@generated by @ilha/router");
  });

  it("maps index.ts → /", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain(`route("/"`);
  });

  it("maps about.ts → /about", async () => {
    await writePage(pagesDir, "about.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain(`route("/about"`);
  });

  it("maps [id].ts → /:id", async () => {
    await writePage(pagesDir, "[id].ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain(`route("/:id"`);
  });

  it("maps user/[id].ts → /user/:id", async () => {
    await writePage(pagesDir, "user/[id].ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain(`route("/user/:id"`);
  });

  it("maps [...slug].ts → /**:slug", async () => {
    await writePage(pagesDir, "[...slug].ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain(`route("/**:slug"`);
  });

  it("maps nested [org]/[repo].ts → /:org/:repo", async () => {
    await writePage(pagesDir, "[org]/[repo].ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain(`route("/:org/:repo"`);
  });

  it("excludes +layout.ts and +error.ts from page routes", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    await writePage(pagesDir, "+layout.ts", `export default null;`);
    await writePage(pagesDir, "+error.ts", `export default null;`);
    const code = await runCodegen();

    // +layout and +error must not appear as routes
    const routeLines = code.split("\n").filter((l) => l.includes(".route("));
    expect(routeLines.every((l) => !l.includes("+layout"))).toBe(true);
    expect(routeLines.every((l) => !l.includes("+error"))).toBe(true);
    // only one route: /
    expect(routeLines).toHaveLength(1);
    expect(routeLines[0]).toContain(`"/"`);
  });

  it("imports root +layout.ts and wraps page", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    await writePage(pagesDir, "+layout.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain("wrapLayout(");
    expect(code).toContain("+layout.ts");
  });

  it("imports root +error.ts and wraps page", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    await writePage(pagesDir, "+error.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain("wrapError(");
    expect(code).toContain("+error.ts");
  });

  it("nested +layout.ts is applied only to pages in its subtree", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    await writePage(pagesDir, "user/index.ts", `export default null;`);
    await writePage(pagesDir, "+layout.ts", `export default null;`);
    await writePage(pagesDir, "user/+layout.ts", `export default null;`);
    const code = await runCodegen();

    const routeLines = code.split("\n").filter((l) => l.includes(".route("));

    // find the two routes regardless of order
    const userLine = routeLines.find((l) => l.includes(`"/user"`));
    const rootLine = routeLines.find((l) => l.includes(`route("/"`));

    // user route gets 2 wrapLayout calls (root + user)
    expect([...userLine!.matchAll(/wrapLayout/g)]).toHaveLength(2);
    // root / route gets 1 wrapLayout call (root only)
    expect([...rootLine!.matchAll(/wrapLayout/g)]).toHaveLength(1);
  });

  it("root layout wraps all pages, nested layout wraps only its subtree", async () => {
    await writePage(pagesDir, "about.ts", `export default null;`);
    await writePage(pagesDir, "user/[id].ts", `export default null;`);
    await writePage(pagesDir, "+layout.ts", `export default null;`);
    await writePage(pagesDir, "user/+layout.ts", `export default null;`);
    const code = await runCodegen();

    // count wrapLayout calls per route line
    const aboutLine = code.split("\n").find((l) => l.includes(`"/about"`));
    const userLine = code.split("\n").find((l) => l.includes(`"/user/:id"`));

    // /about gets 1 wrapLayout (root only)
    expect([...aboutLine!.matchAll(/wrapLayout/g)]).toHaveLength(1);
    // /user/:id gets 2 wrapLayouts (root + user)
    expect([...userLine!.matchAll(/wrapLayout/g)]).toHaveLength(2);
  });

  it("generates export default pageRouter", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain("export default pageRouter");
  });

  it("generates export const pageRouter", async () => {
    await writePage(pagesDir, "index.ts", `export default null;`);
    const code = await runCodegen();
    expect(code).toContain("export const pageRouter");
  });

  it("empty pages dir generates an empty router", async () => {
    const code = await runCodegen();
    expect(code).toContain("export const pageRouter = router()");
    expect(code).not.toContain(".route(");
  });
});

// ─────────────────────────────────────────────
// Vite plugin — virtual module
// ─────────────────────────────────────────────

describe("pages() Vite plugin", () => {
  it("resolves 'ilha:pages' virtual id", () => {
    const plugin = pages() as any;
    expect(plugin.resolveId("ilha:pages")).toBe("\0ilha:pages");
  });

  it("returns null for unrelated ids", () => {
    const plugin = pages() as any;
    expect(plugin.resolveId("some-other-module")).toBeUndefined();
  });

  it("load() for virtual id returns re-export of generated file", async () => {
    const root = await makeDir("vite");
    const pagesDir = join(root, "src/pages");
    const outFile = join(root, "src/generated/page-routes.ts");
    await mkdir(pagesDir, { recursive: true });

    const plugin = pages({ dir: pagesDir, generated: outFile }) as any;
    plugin.configResolved({ root });

    const result = plugin.load("\0ilha:pages");
    expect(result).toContain("page-routes.ts");
    expect(result).toContain("export");

    await removeDir(root);
  });

  it("load() returns undefined for unrelated ids", () => {
    const plugin = pages() as any;
    expect(plugin.load("something-else")).toBeUndefined();
  });

  it("plugin has correct name", () => {
    const plugin = pages() as any;
    expect(plugin.name).toBe("ilha:pages");
  });

  it("configResolved sets root-relative paths", async () => {
    const root = await makeDir("cfg");
    const plugin = pages({ dir: "src/pages", generated: "src/generated/routes.ts" }) as any;
    plugin.configResolved({ root });

    // buildStart should not throw (creates dirs as needed)
    await mkdir(join(root, "src/pages"), { recursive: true });
    expect(plugin.buildStart()).resolves.toBeUndefined();

    await removeDir(root);
  });
});
