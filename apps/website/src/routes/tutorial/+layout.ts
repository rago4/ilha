import RootLayout from "$routes/+layout";
import { effect } from "alien-signals";
import dedent from "dedent";
import ilha, { html } from "ilha";

type Code = { template: string; script: string };

function buildSrcDoc() {
  return dedent`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <script type="importmap">{"imports":{"ilha":"https://esm.sh/pr/ilha@main"}}</script>
      <script type="module">
        window.addEventListener("message", async ({ data }) => {
          if (data?.type !== "ilha:preview") return;

          // Tear down previous run
          document.body.innerHTML = data.template;

          // Re-run script as a blob module so it gets a fresh scope
          const blob = new Blob([data.script], { type: "text/javascript" });
          const url  = URL.createObjectURL(blob);
          try {
            await import(url);
          } finally {
            URL.revokeObjectURL(url);
          }
        });
      </script>
    </body>
    </html>
  `;
}

type TutorialLayoutProps = { content: string; code: Code };

const TutorialLayout = ({ content, code }: TutorialLayoutProps) => {
  const template = ilha.context("tutorial.template", code.template);
  const script = ilha.context("tutorial.script", code.script);

  const Editor = ilha
    .bind("[data-template]", template)
    .bind("[data-script]", script)
    .render(
      () => html`
        <div class="flex-1">
          <textarea class="textarea" data-template></textarea>
          <textarea class="textarea" data-script></textarea>
        </div>
      `,
    );

  const Preview = ilha
    .effect(({ el }) => {
      const iframe = el.querySelector<HTMLIFrameElement>("iframe")!;

      const buildMessage = () => ({
        type: "ilha:preview",
        template: template(),
        script: script(),
      });

      // Once iframe is ready, send initial content
      const send = () => {
        iframe.contentWindow?.postMessage(buildMessage(), "*");
      };

      iframe.addEventListener("load", send, { once: true });

      // On subsequent signal changes, post directly
      const stop = effect(() => {
        if (iframe.contentDocument?.readyState === "complete") {
          iframe.contentWindow?.postMessage(buildMessage(), "*");
        }
      });

      return stop;
    })
    .render(
      () => html`
      <div class="flex-1 border-t">
        <iframe srcdoc="${buildSrcDoc()}"></iframe>
      </div>
    `,
    );

  return ilha
    .slot("editor", Editor)
    .slot("preview", Preview)
    .render(
      ({ slots }) => html`
      <div class="flex-1 flex">
        <div class="flex-1 border-r">${content}</div>
        <div class="flex-1 flex flex-col">
          ${slots.editor()}
          ${slots.preview()}
        </div>
      </div>
    `,
    );
};

export default (props: TutorialLayoutProps) => RootLayout(TutorialLayout(props));
