import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";

import ilha from "ilha";

import {
  router,
  navigate,
  useRoute,
  isActive,
  enableLinkInterception,
  RouterView,
  routePath,
  routeParams,
  routeSearch,
} from "./index";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeEl(inner = ""): Element {
  const el = document.createElement("div");
  el.innerHTML = inner;
  document.body.appendChild(el);
  return el;
}

function cleanup(el: Element) {
  document.body.removeChild(el);
}

function setLocation(path: string) {
  window.location.href = "http://localhost" + path;
}

function popstate() {
  window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
}

function detached() {
  return document.createElement("div");
}

// ─────────────────────────────────────────────
// Shared page islands
// ─────────────────────────────────────────────

const homePage = ilha.render(() => `<p>home</p>`);
const aboutPage = ilha.render(() => `<p>about</p>`);
const userPage = ilha.render(() => {
  const { params } = useRoute();
  return `<p>user:${params().id ?? "none"}</p>`;
});
const notFound = ilha.render(() => `<p>404</p>`);

// ─────────────────────────────────────────────
// route matching
// ─────────────────────────────────────────────

describe("route matching", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router()
      .route("/", homePage)
      .route("/about", aboutPage)
      .route("/user/:id", userPage)
      .route("/**", notFound)
      .mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("matches static root route", () => {
    expect(routePath()).toBe("/");
    expect(el.innerHTML).toContain("home");
  });

  it("matches static /about route after navigate()", () => {
    navigate("/about");
    expect(routePath()).toBe("/about");
    expect(el.innerHTML).toContain("about");
  });

  it("matches :id param route and populates routeParams", () => {
    navigate("/user/42");
    expect(routePath()).toBe("/user/42");
    expect(routeParams()).toEqual({ id: "42" });
  });

  it("matches wildcard /** for unknown paths", () => {
    navigate("/does-not-exist");
    expect(el.innerHTML).toContain("404");
  });

  it("clears params when navigating away from a param route", () => {
    navigate("/user/7");
    expect(routeParams()).toEqual({ id: "7" });
    navigate("/about");
    expect(routeParams()).toEqual({});
  });

  it("matches routes in declaration order — first match wins", () => {
    navigate("/about");
    expect(el.innerHTML).toContain("about");
    expect(el.innerHTML).not.toContain("404");
  });
});

// ─────────────────────────────────────────────
// navigate()
// ─────────────────────────────────────────────

describe("navigate()", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router().route("/", homePage).route("/about", aboutPage).mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("pushes a new history entry by default", () => {
    const before = history.length;
    navigate("/about");
    expect(history.length).toBe(before + 1);
  });

  it("replaces history entry when replace: true", () => {
    const before = history.length;
    navigate("/about", { replace: true });
    expect(history.length).toBe(before);
  });

  it("updates routePath signal", () => {
    navigate("/about");
    expect(routePath()).toBe("/about");
  });

  it("updates routeSearch signal", () => {
    navigate("/about?tab=docs");
    expect(routeSearch()).toBe("?tab=docs");
  });

  it("re-renders outlet to matched island", () => {
    expect(el.innerHTML).toContain("home");
    navigate("/about");
    expect(el.innerHTML).toContain("about");
  });

  it("renders empty outlet for unmatched path (no wildcard)", () => {
    unmount();
    unmount = router().route("/", homePage).mount(el);
    navigate("/ghost");
    expect(el.querySelector("[data-router-empty]")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// popstate
// ─────────────────────────────────────────────

describe("popstate", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router().route("/", homePage).route("/about", aboutPage).mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("syncs route when popstate fires", () => {
    setLocation("/about");
    popstate();
    expect(routePath()).toBe("/about");
    expect(el.innerHTML).toContain("about");
  });

  it("does NOT respond to popstate after unmount", () => {
    unmount();
    setLocation("/about");
    popstate();
    expect(routePath()).toBe("/");
  });
});

// ─────────────────────────────────────────────
// useRoute()
// ─────────────────────────────────────────────

describe("useRoute()", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router().route("/", homePage).route("/user/:id", userPage).mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("path signal matches current location", () => {
    expect(useRoute().path()).toBe("/");
  });

  it("params signal is empty on non-param route", () => {
    expect(useRoute().params()).toEqual({});
  });

  it("params signal reflects :id after navigate", () => {
    navigate("/user/99");
    expect(useRoute().params()).toEqual({ id: "99" });
  });

  it("search signal reflects query string", () => {
    navigate("/user/1?ref=home");
    expect(useRoute().search()).toBe("?ref=home");
  });
});

// ─────────────────────────────────────────────
// isActive()
// ─────────────────────────────────────────────

describe("isActive()", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router()
      .route("/", homePage)
      .route("/about", aboutPage)
      .route("/user/:id", userPage)
      .mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("returns true for the current exact path", () => {
    expect(isActive("/")).toBe(true);
  });

  it("returns false for a non-current path", () => {
    expect(isActive("/about")).toBe(false);
  });

  it("returns true after navigating to that path", () => {
    navigate("/about");
    expect(isActive("/about")).toBe(true);
    expect(isActive("/")).toBe(false);
  });

  it("returns true for :id pattern when a matching path is active", () => {
    navigate("/user/7");
    expect(isActive("/user/:id")).toBe(true);
  });

  it("returns false for :id pattern when a different path is active", () => {
    navigate("/about");
    expect(isActive("/user/:id")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// enableLinkInterception()
// ─────────────────────────────────────────────

describe("enableLinkInterception()", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router().route("/", homePage).route("/about", aboutPage).mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("intercepts internal <a> clicks and navigates client-side", () => {
    const link = document.createElement("a");
    link.setAttribute("href", "/about");
    el.appendChild(link);
    link.click();
    expect(routePath()).toBe("/about");
    expect(el.innerHTML).toContain("about");
  });

  it("does not intercept clicks with ctrlKey held", () => {
    const root = detached();
    const link = document.createElement("a");
    link.setAttribute("href", "/about");
    root.appendChild(link);
    const stop = enableLinkInterception(root);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
    stop();
    expect(routePath()).toBe("/");
  });

  it("does not intercept target=_blank links", () => {
    const root = detached();
    const link = document.createElement("a");
    link.setAttribute("href", "/about");
    link.setAttribute("target", "_blank");
    root.appendChild(link);
    const stop = enableLinkInterception(root);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    stop();
    expect(routePath()).toBe("/");
  });

  it("does not intercept anchor-only (#hash) links", () => {
    const root = detached();
    const link = document.createElement("a");
    link.setAttribute("href", "#section");
    root.appendChild(link);
    const stop = enableLinkInterception(root);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    stop();
    expect(routePath()).toBe("/");
  });

  it("returns a cleanup that removes its listener", () => {
    const root = detached();
    const link = document.createElement("a");
    link.setAttribute("href", "/about");
    root.appendChild(link);
    const stop = enableLinkInterception(root);
    stop();
    link.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true }));
    expect(routePath()).toBe("/");
  });
});

// ─────────────────────────────────────────────
// RouterView
// ─────────────────────────────────────────────

describe("RouterView", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router().route("/", homePage).route("/about", aboutPage).mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("renders matched island inside data-router-view wrapper", () => {
    expect(el.querySelector("[data-router-view]")).not.toBeNull();
    expect(el.innerHTML).toContain("home");
  });

  it("re-renders outlet reactively on navigate", () => {
    navigate("/about");
    expect(el.querySelector("[data-router-view]")).not.toBeNull();
    expect(el.innerHTML).toContain("about");
  });

  it("renders data-router-empty when no route matches", () => {
    unmount();
    unmount = router().route("/", homePage).mount(el);
    navigate("/unknown");
    expect(el.querySelector("[data-router-empty]")).not.toBeNull();
  });

  it("RouterView is a valid ilha Island (has .mount and .toString)", () => {
    expect(typeof RouterView.mount).toBe("function");
    expect(typeof RouterView.toString).toBe("function");
  });
});

// ─────────────────────────────────────────────
// router() isolation
// ─────────────────────────────────────────────

describe("router() isolation", () => {
  it("calling router() resets the route registry", () => {
    setLocation("/");
    const el1 = makeEl();
    const el2 = makeEl();
    const u1 = router().route("/", homePage).route("/about", aboutPage).mount(el1);
    const u2 = router().route("/", homePage).mount(el2);
    navigate("/about");
    expect(el2.querySelector("[data-router-empty]")).not.toBeNull();
    u1();
    u2();
    cleanup(el1);
    cleanup(el2);
    setLocation("/");
  });

  it("unmount() removes the popstate listener", () => {
    setLocation("/");
    const el = makeEl();
    const unmount = router().route("/", homePage).route("/about", aboutPage).mount(el);
    unmount();
    setLocation("/about");
    popstate();
    expect(routePath()).toBe("/");
    cleanup(el);
    setLocation("/");
  });
});

// ─────────────────────────────────────────────
// URL encoding
// ─────────────────────────────────────────────

describe("URL encoding", () => {
  let el: Element;
  let unmount: () => void;

  beforeEach(() => {
    setLocation("/");
    el = makeEl();
    unmount = router().route("/user/:id", userPage).route("/**", notFound).mount(el);
  });

  afterEach(() => {
    unmount();
    cleanup(el);
    setLocation("/");
  });

  it("decodes percent-encoded param values", () => {
    navigate("/user/hello%20world");
    expect(routeParams()).toEqual({ id: "hello world" });
  });
});

// ─────────────────────────────────────────────
// warn on missing selector
// ─────────────────────────────────────────────

describe("router() — missing host element", () => {
  it("warns and returns a no-op unmount when selector not found", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const unmount = router().route("/", homePage).mount("#does-not-exist");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[ilha-router]"));
    expect(typeof unmount).toBe("function");
    unmount();
    warn.mockRestore();
  });
});

// ─────────────────────────────────────────────
// rou3 pattern syntax
// ─────────────────────────────────────────────

describe("rou3 pattern syntax", () => {
  it(":param — single named segment", () => {
    router().route("/user/:id", userPage).render("/user/42");
    expect(routeParams()).toEqual({ id: "42" });
  });

  it("**:slug — named catch-all captures rest of path", () => {
    const catchAll = ilha.render(() => {
      const { params } = useRoute();
      return `<p>slug:${(params() as any).slug ?? ""}</p>`;
    });
    const html = router().route("/docs/**:slug", catchAll).render("/docs/guide/intro");
    expect(html).toContain("slug:guide/intro");
    expect(routeParams()).toMatchObject({ slug: "guide/intro" });
  });

  it("/** — anonymous wildcard matches anything", () => {
    const html = router().route("/", homePage).route("/**", notFound).render("/anything/nested");
    expect(html).toContain("404");
  });

  it("multiple :param segments", () => {
    const page = ilha.render(() => {
      const { params } = useRoute();
      const p = params() as any;
      return `<p>${p.org}/${p.repo}</p>`;
    });
    router().route("/:org/:repo", page).render("/ilha/router");
    expect(routeParams()).toEqual({ org: "ilha", repo: "router" });
  });

  it("static segment takes priority over :param", () => {
    const special = ilha.render(() => `<p>special</p>`);
    const html = router()
      .route("/user/me", special)
      .route("/user/:id", userPage)
      .render("/user/me");
    expect(html).toContain("special");
    expect(html).not.toContain("user:");
  });
});

// ─────────────────────────────────────────────
// SSR — router().render()
// ─────────────────────────────────────────────

describe("SSR render()", () => {
  it("renders matched island for root path", () => {
    const html = router()
      .route("/", homePage)
      .route("/about", aboutPage)
      .route("/**", notFound)
      .render("/");
    expect(html).toContain("home");
    expect(html).toContain("data-router-view");
  });

  it("renders matched island for /about", () => {
    const html = router()
      .route("/", homePage)
      .route("/about", aboutPage)
      .route("/**", notFound)
      .render("/about");
    expect(html).toContain("about");
    expect(html).not.toContain("home");
  });

  it("renders wildcard for unmatched path", () => {
    const html = router().route("/", homePage).route("/**", notFound).render("/does-not-exist");
    expect(html).toContain("404");
  });

  it("renders data-router-empty when no route matches and no wildcard", () => {
    const html = router().route("/", homePage).render("/unknown");
    expect(html).toContain("data-router-empty");
  });

  it("resolves :id route and populates routeParams signal", () => {
    router().route("/user/:id", userPage).route("/**", notFound).render("/user/42");
    expect(routeParams()).toEqual({ id: "42" });
    expect(routePath()).toBe("/user/42");
  });

  it("populates routeSearch signal from query string", () => {
    router().route("/about", aboutPage).render("/about?tab=docs");
    expect(routeSearch()).toBe("?tab=docs");
  });

  it("accepts a full URL string", () => {
    const html = router()
      .route("/about", aboutPage)
      .route("/**", notFound)
      .render("http://example.com/about?ref=test");
    expect(html).toContain("about");
    expect(routeSearch()).toBe("?ref=test");
  });

  it("accepts a URL object", () => {
    const html = router()
      .route("/about", aboutPage)
      .route("/**", notFound)
      .render(new URL("http://example.com/about"));
    expect(html).toContain("about");
  });

  it("decodes percent-encoded params", () => {
    router().route("/user/:id", userPage).render("/user/hello%20world");
    expect(routeParams()).toEqual({ id: "hello world" });
  });

  it("isActive() reflects last render() path", () => {
    router().route("/", homePage).route("/about", aboutPage).render("/about");
    expect(isActive("/about")).toBe(true);
    expect(isActive("/")).toBe(false);
  });

  it("useRoute() signals reflect last render() call", () => {
    router().route("/user/:id", userPage).render("/user/99?sort=asc");
    const { path, params, search } = useRoute();
    expect(path()).toBe("/user/99");
    expect(params()).toEqual({ id: "99" });
    expect(search()).toBe("?sort=asc");
  });
});
