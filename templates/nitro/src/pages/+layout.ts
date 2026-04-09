import { isActive } from "@ilha/router";
import type { LayoutHandler } from "@ilha/router/vite";
import ilha, { html } from "ilha";

export default ((children) =>
  ilha.slot("children", children).render(
    ({ slots }) => html`
    <nav>
      <a href="/" class="${isActive("/") ? "active" : ""}">Home</a>
      <a href="/about" class="${isActive("/about") ? "active" : ""}">About</a>
    </nav>
    <main id="content">
      ${slots.children()}
    </main>
  `,
  )) satisfies LayoutHandler;
