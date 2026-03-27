import Layout from "./+layout";

const content = `
  # Hello World
`;

const code = {
  template: `
    <div data-ilha="nameInput"></div>
    <div data-ilha="hello"></div>
  `,
  script: `
    import ilha, { html, mount } from "ilha";

    const name = ilha.context("name", "Alice");

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

export default Layout({ content, code });
