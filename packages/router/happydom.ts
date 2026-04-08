import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  settings: {
    fetch: {
      interceptor: {
        async beforeAsyncRequest() {
          return new Response("", { status: 200 }) as any;
        },
      },
    },
  },
});
