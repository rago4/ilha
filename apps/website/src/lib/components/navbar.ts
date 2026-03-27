import ilha, { html } from "ilha";

export const navbar = ilha.render(
  () => html`
    <nav class="flex items-center justify-center">
      <div class="container flex items-center justify-between p-2">
        <a href="/" class="btn-ghost">Ilha</a>
        <div class="flex items-center gap-2">
          <a href="/docs" class="btn-link">Docs</a>
          <a href="/tutorial" class="btn-link">Tutorial</a>
        </div>
      </div>
    </nav>
  `,
);
