import "./app.css";
import "basecoat-css/all";
import ilha, { html, mount } from "ilha";

const app = ilha.render(
  () => html`
    <div>
      <button class="btn">let's go</button>
    </div>
  `,
);

mount({ app });
