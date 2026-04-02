import ilha, { html, mount } from "ilha";

import "./style.css";

const app = ilha.render(
  () => html`
    <p>ok</p>
  `,
);

mount({ app });
