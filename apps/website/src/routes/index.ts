import ilha, { html } from "ilha";

import Layout from "./+layout";

const Home = ilha.render(
  () => html`
    <div>
      <h1>Welcome to Ilha!</h1>
      <p>A modern web framework for building fast, reactive UIs.</p>
    </div>
  `,
);

export default Layout(Home);
