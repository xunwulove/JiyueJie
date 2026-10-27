import { useNavigation, useRoute } from "@react-navigation/native";
import { createContext, useCallback, useContext } from "react";
import { LogBox } from "react-native";
import { useSetAtom } from "jotai";
import { tabletSubPagesAtom } from "@/core/tabletNav";
import { isTabletScreen } from "@/utils/tablet";

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
    /** 音乐播放页 */
    MUSIC_DETAIL: "music-detail",
    /** 本地歌单页 */
    LOCAL_SHEET_DETAIL: "local-sheet-detail",
    /** 专辑页 */
    ALBUM_DETAIL: "album-detail",
    /** 歌手页 */
    ARTIST_DETAIL: "artist-detail",
    /** 榜单页 */
    TOP_LIST: "top-list",
    /** 榜单详情页 */
    TOP_LIST_DETAIL: "top-list-detail",
    /** 设置页 */
    SETTING: "setting",
    /** 本地音乐 */
    LOCAL: "local",
    /** 本地音乐分组（专辑/歌手/文件夹） */
    LOCAL_GROUP: "local-group",
    /** 正在下载 */
    DOWNLOADING: "downloading",
    /** 从歌曲列表中搜索 */
    SEARCH_MUSIC_LIST: "search-music-list",
    /** 批量编辑 */
    MUSIC_LIST_EDITOR: "music-list-editor",
    /** 推荐歌单 */
    RECOMMEND_SHEETS: "recommend-sheets",
    /** 歌单详情 */
    PLUGIN_SHEET_DETAIL: "plugin-sheet-detail",
    /** 历史记录 */
    HISTORY: "history",
    /** 统计 */
    STATISTICS: "statistics",
    /** 扫描设置（媒体来源） */
    SCAN_SETTINGS: "scan-settings",
    /** 音源管理（独立二级页，复用插件管理） */
    PLUGIN_SOURCES: "plugin-sources",
    /** 备份与恢复（独立二级页，复用备份设置） */
    BACKUP: "backup",
    /** 音源排序（独立二级页，替代插件设置内嵌套原生栈） */
    PLUGIN_SORT: "plugin-sort",
    /** 我的歌单（歌单管理：新建/导入/删除，独立二级页） */
    SHEET_MANAGER: "sheet-manager",
    /** 网易/QQ 接口歌单·榜单详情（推荐歌单/排行榜数据层为公开接口） */
    API_SHEET_DETAIL: "api-sheet-detail",
    /** 音效设置（均衡器/低音增强/环绕声，独立二级页） */
    SOUND_EFFECT: "sound-effect",
    /** 音源探测（独立 App 根页面） */
    PROBE: "probe",
} as const;

type ValueOf<T> = T[keyof T];
type RoutePaths = ValueOf<typeof ROUTE_PATH>;

type RouterParamsBase = Record<RoutePaths, any>;
/** 路由参数 */
interface RouterParams extends RouterParamsBase {
    home: undefined;
    "music-detail": undefined;
    "local-sheet-detail": {
        id: string;
    };
    "local-group": {
        groupType: "album" | "artist" | "folder";
    };
    "album-detail": {
        albumItem: IAlbum.IAlbumItem;
    };
    "artist-detail": {
        artistItem: IArtist.IArtistItem;
        pluginHash: string;
    };
    setting: {
        type: string;
        // anchor?: string | number;
    };
    local: undefined;
    downloading: undefined;
    "search-music-list": {
        musicList: IMusic.IMusicItem[] | null;
        musicSheet?: IMusic.IMusicSheetItem;
    };
    "music-list-editor": {
        musicSheet?: Partial<IMusic.IMusicSheetItem>;
        musicList: IMusic.IMusicItem[] | null;
    };
    "top-list-detail": {
        pluginHash: string;
        topList: IMusic.IMusicSheetItemBase;
    };
    "plugin-sheet-detail": {
        pluginHash?: string;
        sheetInfo: IMusic.IMusicSheetItemBase;
    };
    /** 扫描设置（媒体来源） */
    "scan-settings": undefined;
    /** 音源管理（独立二级页，复用插件管理） */
    "plugin-sources": undefined;
    /** 备份与恢复（独立二级页） */
    backup: undefined;
    /** 音源排序（独立二级页，替代插件设置内嵌套原生栈） */
    "plugin-sort": undefined;
    /** 我的歌单（歌单管理） */
    "sheet-manager": undefined;
    /** 网易/QQ 接口歌单·榜单详情 */
    "api-sheet-detail": {
        sheetInfo: IMusic.IMusicSheetItemBase;
    };
    /** 音源探测 */
    probe: undefined;
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
