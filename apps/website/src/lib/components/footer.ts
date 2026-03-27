import ilha, { html } from "ilha";

export const footer = ilha.state("year", new Date().getFullYear()).render(
  ({ state }) => html`
    <footer class="flex items-center justify-center">
      <div class="container flex items-center justify-between p-2">
        <a href="/" class="btn-ghost">Ilha</a>
        <p>${state.year}</p>
      </div>
    </footer>
  `,
);
