import ilha, { html } from "ilha";

import Layout from "./+layout";

const Error = ilha.render(
  () => html`
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
    </div>
  `,
);

export default Layout(Error);
