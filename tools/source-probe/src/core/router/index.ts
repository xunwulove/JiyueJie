import { useNavigation, useRoute } from "@react-navigation/native";
import { createContext, useCallback, useContext } from "react";
import { LogBox } from "react-native";
import { useSetAtom } from "jotai";
import { tabletSubPagesAtom } from "@/core/tabletNav";
import { isTabletScreen } from "@/utils/tablet";
import type { IProbeResult } from "@/core/probe";

LogBox.ignoreLogs([
    "Non-serializable values were found in the navigation state",
]);

/**
 * 平板覆盖层帧参数上下文：
 * 覆盖层栈内每一页都常驻挂载渲染（subPageOverlay.tsx）。旧实现 useParams 在栈非空时
 * 统一返回栈顶 params，导致下层帧每次重渲染拿到栈顶参数（artistDetail header 崩、setting 静默切页）。
 * 现改为：每个覆盖层帧由 subPageOverlay 用本帧 page.params 包裹 <Component/>，
 * useParams 优先消费本帧注入的 params；原生栈/ tab 内容页不包裹，回退 route.params。
 */
const TABLET_FRAME_PARAMS_UNSET = Symbol("tablet-frame-params-unset");
const TabletFrameParamsContext = createContext<
    Record<string, unknown> | typeof TABLET_FRAME_PARAMS_UNSET
>(TABLET_FRAME_PARAMS_UNSET);

/** 平板覆盖层帧参数 Provider（subPageOverlay 渲染每帧时包裹 <Component/>） */
export const TabletFrameParamsProvider = TabletFrameParamsContext.Provider;

/** 路由key */
export const ROUTE_PATH = {
    /** 主页 */
    HOME: "home",
    /** 音源管理（独立二级页，复用插件管理） */
    PLUGIN_SOURCES: "plugin-sources",
    /** 音源排序（独立二级页，替代插件设置内嵌套原生栈） */
    PLUGIN_SORT: "plugin-sort",
    /** 源鉴（独立 App 根页面） */
    PROBE: "probe",
    /** 源鉴·音源详情（二级页：能力矩阵+失败原因+建议动作+试听） */
    PROBE_DETAIL: "probe-detail",
    /** 源鉴·关于（应用信息/版本/开源许可） */
    ABOUT: "about",
} as const;

type ValueOf<T> = T[keyof T];
type RoutePaths = ValueOf<typeof ROUTE_PATH>;

type RouterParamsBase = Record<RoutePaths, any>;
/** 路由参数 */
interface RouterParams extends RouterParamsBase {
    home: undefined;
    /** 音源管理（独立二级页，复用插件管理） */
    "plugin-sources": undefined;
    /** 音源排序（独立二级页，替代插件设置内嵌套原生栈） */
    "plugin-sort": undefined;
    /** 源鉴 */
    probe: undefined;
    /** 源鉴·音源详情 */
    "probe-detail": {
        result: IProbeResult;
    };
    /** 源鉴·关于 */
    about: undefined;
}

/** 路由参数Hook */
export function useParams<T extends RoutePaths>(): RouterParams[T] {
    const route = useRoute<any>();

    // 覆盖层帧内：优先消费本帧 Provider 注入的 params（每帧只拿自己的参数，避免栈顶污染下层帧）
    const frameParams = useContext(TabletFrameParamsContext);
    if (frameParams !== TABLET_FRAME_PARAMS_UNSET) {
        return frameParams as RouterParams[T];
    }

    // 原生栈 / tab 内容页：取 React Navigation 当前路由参数
    const routeParams = route?.params as RouterParams[T];
    return routeParams;
}

/** 导航 */
export function useNavigate() {
    const navigation = useNavigation<any>();
    const setTabletSubPages = useSetAtom(tabletSubPagesAtom);

    const navigate = useCallback(function <T extends RoutePaths>(
        route: T,
        params?: RouterParams[T],
    ) {
        // 平板：二级页面（非首页）走右内容区覆盖层栈；手机走原生栈
        if (isTabletScreen() && route !== ROUTE_PATH.HOME) {
            setTabletSubPages(prev => [
                ...prev,
                {
                    path: route,
                    params,
                    key: `${route}-${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 6)}`,
                },
            ]);
            return;
        }
        navigation.navigate(route, params);
    }, [navigation, setTabletSubPages]);

    return navigate;
}
