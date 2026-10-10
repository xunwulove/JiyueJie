import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback } from "react";
import { LogBox } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { tabletSubPagesAtom } from "@/core/tabletNav";
import { isTabletScreen } from "@/utils/tablet";

LogBox.ignoreLogs([
    "Non-serializable values were found in the navigation state",
]);

/** 路由key */
export const ROUTE_PATH = {
    /** 主页 */
    HOME: "home",
    /** 音乐播放页 */
    MUSIC_DETAIL: "music-detail",
    /** 搜索页 */
    SEARCH_PAGE: "search-page",
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
    /** 选择文件夹 */
    FILE_SELECTOR: "file-selector",
    /** 推荐歌单 */
    RECOMMEND_SHEETS: "recommend-sheets",
    /** 歌单详情 */
    PLUGIN_SHEET_DETAIL: "plugin-sheet-detail",
    /** 历史记录 */
    HISTORY: "history",
    /** 统计 */
    STATISTICS: "statistics",
    /** 自定义主题 */
    SET_CUSTOM_THEME: "set-custom-theme",
    /** 权限管理 */
    PERMISSIONS: "permissions",
    /** 扫描设置（媒体来源） */
    SCAN_SETTINGS: "scan-settings",
    /** 音源管理（独立二级页，复用插件管理） */
    PLUGIN_SOURCES: "plugin-sources",
    /** 备份与恢复（独立二级页，复用备份设置） */
    BACKUP: "backup",
    /** 音源排序（独立二级页，替代插件设置内嵌套原生栈） */
    PLUGIN_SORT: "plugin-sort",
    /** 音源订阅（独立二级页，替代插件设置内嵌套原生栈） */
    PLUGIN_SUBSCRIBE: "plugin-subscribe",
    /** 我的歌单（歌单管理：新建/导入/删除，独立二级页） */
    SHEET_MANAGER: "sheet-manager",
    /** 网易/QQ 接口歌单·榜单详情（推荐歌单/排行榜数据层为公开接口） */
    API_SHEET_DETAIL: "api-sheet-detail",
} as const;

type ValueOf<T> = T[keyof T];
type RoutePaths = ValueOf<typeof ROUTE_PATH>;

type RouterParamsBase = Record<RoutePaths, any>;
/** 路由参数 */
interface RouterParams extends RouterParamsBase {
    home: undefined;
    "music-detail": undefined;
    "search-page": undefined;
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
    "file-selector": {
        fileType?: "folder" | "file" | "file-and-folder"; // 10: folder 11: file and folder,
        multi?: boolean; // 是否多选
        actionText?: string; // 底部行动点的文本
        actionIcon?: string; // 底部行动点的图标
        onAction?: (
            selectedFiles: {
                path: string;
                type: "file" | "folder";
            }[],
        ) => Promise<boolean>; // true会自动关闭，false会停在当前页面
        matchExtension?: (path: string) => boolean;
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
    /** 音源订阅（独立二级页，替代插件设置内嵌套原生栈） */
    "plugin-subscribe": undefined;
    /** 我的歌单（歌单管理） */
    "sheet-manager": undefined;
    /** 网易/QQ 接口歌单·榜单详情 */
    "api-sheet-detail": {
        sheetInfo: IMusic.IMusicSheetItemBase;
    };
}

/** 路由参数Hook */
export function useParams<T extends RoutePaths>(): RouterParams[T] {
    const route = useRoute<any>();

    // 平板二级页覆盖层激活时：参数取自覆盖层栈顶（覆盖层组件不在 React Navigation 栈内）
    const subPages = useAtomValue(tabletSubPagesAtom);
    const top = subPages[subPages.length - 1];
    if (top) {
        return top.params as RouterParams[T];
    }

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
