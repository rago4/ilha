import { footer } from "$lib/components/footer";
import { navbar } from "$lib/components/navbar";
import type { Island } from "ilha";
import ilha, { html } from "ilha";

export default (child: Island) =>
  ilha
    .slot("navbar", navbar)
    .slot("footer", footer)
    .slot("child", child)
    .render(({ slots }) => {
      return html`
      <div class="flex flex-col gap-2 min-h-screen">
        ${slots.navbar()}
        <div class="flex-1 flex flex-col container mx-auto p-2">
          ${slots.child()}
        </div>
        ${slots.footer()}
      </div>
    `;
    });
