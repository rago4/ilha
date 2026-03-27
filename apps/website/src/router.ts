import type { RouteParams } from "$lib/route";
import ErrorRoute from "$routes/+error";
import HomeRoute from "$routes/index";
import HelloWorldRoute from "$routes/tutorial/index";
import type { Island } from "ilha";
import { addRoute, createRouter } from "rou3";

export const router = createRouter<{ component: Island<RouteParams> }>();

addRoute(router, "GET", "/", { component: HomeRoute });
addRoute(router, "GET", "/tutorial", { component: HelloWorldRoute });
addRoute(router, "GET", "/**", { component: ErrorRoute });
