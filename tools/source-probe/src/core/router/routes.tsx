import PluginSources from "@/pages/pluginSources";
import Probe from "@/pages/probe";
import { ROUTE_PATH } from "@/core/router/index.ts";

type ValueOf<T> = T[keyof T];
export type RoutePaths = ValueOf<typeof ROUTE_PATH>;

type IRoutes = {
  path: RoutePaths;
  component: (...args: any[]) => JSX.Element;
};


export const routes: Array<IRoutes> = [
    {
        path: ROUTE_PATH.PROBE,
        component: Probe,
    },
    {
        path: ROUTE_PATH.PLUGIN_SOURCES,
        component: PluginSources,
    },
];
