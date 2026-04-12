import { URLS } from "$lib/const";
import ilha, { html } from "ilha";

export const footer = ilha.render(
  () => html`
    <footer class="container mx-auto mt-20 py-16 p-4">
      <h2 class="sr-only">Footer</h2>
      <div class="grid gap-8 text-sm text-foreground/60 md:grid-cols-4 md:items-start">
        <nav aria-label="Open source">
          <h3 class="font-semibold text-foreground/80">Open Source</h3>
          <div class="mt-4 grid justify-items-start gap-2">
            <a href="${URLS.GITHUB}" target="_blank" rel="noopener noreferrer" class="transition hover:text-foreground">Ilha</a>
            <a href="${URLS.DOCSOME}" target="_blank" rel="noopener noreferrer" class="transition hover:text-foreground">Docsome</a>
          </div>
        </nav>
        <nav aria-label="Legals">
          <h3 class="font-semibold text-foreground/80">Legals</h3>
          <div class="mt-4 grid justify-items-start gap-2">
            <a href="#" class="transition hover:text-foreground">Terms of Service</a>
            <a href="#" class="transition hover:text-foreground">Privacy Policy</a>
          </div>
        </nav>
        <div class="hidden md:block"></div>
        <nav aria-label="Socials" class="md:justify-self-end">
          <h3 class="font-semibold text-foreground/80">Socials</h3>
          <div class="mt-4 grid justify-items-start gap-2">
            <a href="${URLS.DISCORD}" target="_blank" rel="noopener noreferrer" class="transition hover:text-foreground">Discord</a>
            <a href="${URLS.X_COM}" target="_blank" rel="noopener noreferrer" class="transition hover:text-foreground">X.com</a>
          </div>
        </nav>
      </div>
      <div class="mt-12 border-t border-foreground/10 pt-8 text-sm text-foreground/50">
        © ${new Date().getFullYear()} Ilha. All rights reserved.
      </div>
    </footer>
  `,
);
