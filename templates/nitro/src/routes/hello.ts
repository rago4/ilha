import ilha, { html } from "ilha";
import { defineHandler } from "nitro";
import * as h3 from "nitro/h3";

const counter = ilha.state("count", 0).render(
  ({ state }) =>
    html`
      <p>Counter: ${state.count()}</p>
    `,
);

export default defineHandler(async () => {
  return h3.html(await counter());
});
