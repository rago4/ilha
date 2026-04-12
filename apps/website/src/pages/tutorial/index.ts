import { Tutorial } from "$lib/components/tutorial";
import dedent from "dedent";

const content = dedent`
  # Hello World
`;

const code = {
  template: dedent`
    <div data-ilha="nameInput"></div>
    <div data-ilha="hello"></div>
  `,
  script: dedent`
    import ilha, { html, mount, context } from "ilha";

    const name = context("name", "Alice");

    const nameInput = ilha
      .bind("[data-name]", name)
      .render(
        () => html\`
          <input type="text" data-name />
        \`);

    const hello = ilha
      .render(
        () => html\`
          <div>Hello, \${name()}</div>
        \`);

    mount({ nameInput, hello });
  `,
};

export default Tutorial({ content, code });
