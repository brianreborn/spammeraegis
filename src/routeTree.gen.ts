/* eslint-disable */
import { Route as rootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";

const indexRoute = IndexRoute.update({ path: "/", getParentRoute: () => rootRoute });

export const routeTree = rootRoute.addChildren([indexRoute]);
