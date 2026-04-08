import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, relative, dirname, basename, extname } from "node:path";

import ilha from "ilha";
import type { Island } from "ilha";
import type { Plugin } from "vite";

import { routePath, routeParams, routeSearch, routeHash } from "./index";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RouteSnapshot {
  path: string;
  params: Record<string, string>;
  search: string;
  hash: string;
}

export interface AppError {
  message: string;
  status?: number;
  stack?: string;
}

export type LayoutHandler = (children: Island<any, any>) => Island<any, any>;
export type ErrorHandler = (error: AppError, route: RouteSnapshot) => Island<any, any>;

// ─────────────────────────────────────────────
// Runtime helpers — wrapLayout / wrapError
// ─────────────────────────────────────────────

export function wrapLayout(layout: LayoutHandler, page: Island<any, any>): Island<any, any> {
  return layout(page);
}

export function wrapError(handler: ErrorHandler, page: Island<any, any>): Island<any, any> {
  return ilha.render(() => {
    try {
      return page.toString();
    } catch (e: any) {
      const route: RouteSnapshot = {
        path: routePath(),
        params: routeParams(),
        search: routeSearch(),
        hash: routeHash(),
      };
      return handler({ message: e.message, status: e.status, stack: e.stack }, route).toString();
    }
  });
}

// ─────────────────────────────────────────────
// Codegen — types
// ─────────────────────────────────────────────

interface PageEntry {
  file: string; // absolute path to page file
  pattern: string; // rou3 pattern e.g. /user/:id
  layouts: string[]; // absolute paths, root → nearest
  errors: string[]; // absolute paths, root → nearest
}

// ─────────────────────────────────────────────
// Codegen — filename → rou3 pattern
// ─────────────────────────────────────────────

function fileToSegment(name: string): string {
  if (name.startsWith("[...") && name.endsWith("]")) return `**:${name.slice(4, -1)}`;
  if (name.startsWith("[") && name.endsWith("]")) return `:${name.slice(1, -1)}`;
  return name;
}

function fileToPattern(pagesDir: string, file: string): string {
  const rel = relative(pagesDir, file);
  const noExt = rel.slice(0, -extname(rel).length);
  const segments = noExt.split("/").map(fileToSegment);
  if (segments[segments.length - 1] === "index") segments.pop();
  const pattern = "/" + segments.filter(Boolean).join("/");
  return pattern || "/";
}

// ─────────────────────────────────────────────
// Codegen — layout / error chain resolution
// ─────────────────────────────────────────────

function chainForFile(pagesDir: string, file: string, all: string[], sentinel: string): string[] {
  const chain: string[] = [];
  const relDir = relative(pagesDir, dirname(file));
  const parts = relDir === "" ? [] : relDir.split("/");

  // walk root → file's own directory, inclusive
  const dirs = [pagesDir, ...parts.map((_, i) => join(pagesDir, ...parts.slice(0, i + 1)))];

  for (const dir of dirs) {
    const candidate = join(dir, sentinel);
    if (all.includes(candidate)) chain.push(candidate);
  }

  return chain;
}

// ─────────────────────────────────────────────
// Codegen — file system scan
// ─────────────────────────────────────────────

async function collectFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(full)));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

async function scanPages(pagesDir: string): Promise<PageEntry[]> {
  const all = await collectFiles(pagesDir);
  const pages = all.filter((f) => !basename(f).startsWith("+"));

  return pages.map((file) => ({
    file,
    pattern: fileToPattern(pagesDir, file),
    layouts: chainForFile(pagesDir, file, all, "+layout.ts"),
    errors: chainForFile(pagesDir, file, all, "+error.ts"),
  }));
}

// ─────────────────────────────────────────────
// Codegen — emit generated file
// ─────────────────────────────────────────────

async function generate(pagesDir: string, outFile: string): Promise<void> {
  const entries = await scanPages(pagesDir);

  const imports: string[] = [
    `import { router }                    from "@ilha/router";`,
    `import { wrapLayout, wrapError }     from "@ilha/router/vite";`,
  ];

  const routeLines: string[] = [];

  for (const [i, entry] of entries.entries()) {
    const pageId = `_page${i}`;
    imports.push(`import ${pageId} from ${JSON.stringify(entry.file)};`);

    for (const [j, l] of entry.layouts.entries())
      imports.push(`import _layout${i}_${j} from ${JSON.stringify(l)};`);

    for (const [j, e] of entry.errors.entries())
      imports.push(`import _error${i}_${j} from ${JSON.stringify(e)};`);

    let expr = pageId;

    // wrap errors inside-out — nearest error boundary is innermost
    for (let j = entry.errors.length - 1; j >= 0; j--) expr = `wrapError(_error${i}_${j}, ${expr})`;

    // wrap layouts inside-out — nearest layout is innermost
    for (let j = entry.layouts.length - 1; j >= 0; j--)
      expr = `wrapLayout(_layout${i}_${j}, ${expr})`;

    routeLines.push(`  .route(${JSON.stringify(entry.pattern)}, ${expr})`);
  }

  const code = [
    `// @generated by @ilha/router — do not edit`,
    ``,
    ...imports,
    ``,
    `export const pageRouter = router()`,
    ...routeLines,
    `  ;`,
    ``,
    `export default pageRouter;`,
  ].join("\n");

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, code, "utf8");
}

// ─────────────────────────────────────────────
// Vite plugin
// ─────────────────────────────────────────────

const VIRTUAL_ID = "ilha:pages";
const RESOLVED = "\0ilha:pages";

export interface IlhaPagesOptions {
  /** Directory containing page files. Default: `src/pages` */
  dir?: string;
  /** Output path for the generated route file. Default: `src/generated/page-routes.ts` */
  generated?: string;
}

export function pages(options: IlhaPagesOptions = {}): Plugin {
  let pagesDir: string;
  let outFile: string;

  async function regen() {
    try {
      await generate(pagesDir, outFile);
    } catch (e) {
      console.error("[ilha:pages] codegen failed:", e);
    }
  }

  return {
    name: "ilha:pages",

    configResolved(config) {
      pagesDir = resolve(config.root, options.dir ?? "src/pages");
      outFile = resolve(config.root, options.generated ?? "src/generated/page-routes.ts");
    },

    async buildStart() {
      await regen();
    },

    configureServer(server) {
      server.watcher.add(pagesDir);

      const invalidate = async (file: string) => {
        if (!file.startsWith(pagesDir)) return;
        await regen();
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.hot.send({ type: "full-reload" });
      };

      server.watcher.on("add", invalidate);
      server.watcher.on("unlink", invalidate);
      server.watcher.on("change", invalidate);
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED;
    },

    load(id) {
      if (id === RESOLVED) return `export { pageRouter, default } from ${JSON.stringify(outFile)};`;
    },
  };
}
