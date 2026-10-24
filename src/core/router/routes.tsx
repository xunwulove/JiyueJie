import Home from "@/pages/home";
import MusicDetail from "@/pages/musicDetail";
import TopList from "@/pages/topList";
import TopListDetail from "@/pages/topListDetail";
import SheetDetail from "@/pages/sheetDetail";
import AlbumDetail from "@/pages/albumDetail";
import ArtistDetail from "@/pages/artistDetail";
import Setting from "@/pages/setting";
import LocalMusic from "@/pages/localMusic";
import LocalGroup from "@/pages/localGroup";
import Downloading from "@/pages/downloading";
import SearchMusicList from "@/pages/searchMusicList";
import MusicListEditor from "@/pages/musicListEditor";
import RecommendSheets from "@/pages/recommendSheets";
import PluginSheetDetail from "@/pages/pluginSheetDetail";
import History from "@/pages/history";
import Statistics from "@/pages/statistics";
import ScanSettings from "@/pages/scanSettings";
import PluginSources from "@/pages/pluginSources";
import Backup from "@/pages/backup";
import PluginSort from "@/pages/setting/settingTypes/pluginSetting/views/pluginSort";
import SheetManager from "@/pages/sheetManager";
import ApiSheetDetail from "@/pages/apiSheetDetail";
import SoundEffectSetting from "@/pages/setting/settingTypes/soundEffectSetting";
import { ROUTE_PATH } from "@/core/router/index.ts";

type ValueOf<T> = T[keyof T];
export type RoutePaths = ValueOf<typeof ROUTE_PATH>;

type IRoutes = {
  path: RoutePaths;
  component: (...args: any[]) => JSX.Element;
};


export const routes: Array<IRoutes> = [
    {
        path: ROUTE_PATH.HOME,
        component: Home,
    },
    {
        path: ROUTE_PATH.MUSIC_DETAIL,
        component: MusicDetail,
    },
    {
        path: ROUTE_PATH.TOP_LIST,
        component: TopList,
    },
    {
        path: ROUTE_PATH.TOP_LIST_DETAIL,
        component: TopListDetail,
    },
    {
        path: ROUTE_PATH.LOCAL_SHEET_DETAIL,
        component: SheetDetail,
    },
    {
        path: ROUTE_PATH.ALBUM_DETAIL,
        component: AlbumDetail,
    },
    {
        path: ROUTE_PATH.ARTIST_DETAIL,
        component: ArtistDetail,
    },
    {
        path: ROUTE_PATH.SETTING,
        component: Setting,
    },
    {
        path: ROUTE_PATH.LOCAL,
        component: LocalMusic,
    },
    {
        path: ROUTE_PATH.LOCAL_GROUP,
        component: LocalGroup,
    },
    {
        path: ROUTE_PATH.DOWNLOADING,
        component: Downloading,
    },
    {
        path: ROUTE_PATH.SEARCH_MUSIC_LIST,
        component: SearchMusicList,
    },
    {
        path: ROUTE_PATH.MUSIC_LIST_EDITOR,
        component: MusicListEditor,
    },
    {
        path: ROUTE_PATH.RECOMMEND_SHEETS,
        component: RecommendSheets,
    },
    {
        path: ROUTE_PATH.PLUGIN_SHEET_DETAIL,
        component: PluginSheetDetail,
    },
    {
        path: ROUTE_PATH.HISTORY,
        component: History,
    },
    {
        path: ROUTE_PATH.STATISTICS,
        component: Statistics,
    },
    {
        path: ROUTE_PATH.SCAN_SETTINGS,
        component: ScanSettings,
    },
    {
        path: ROUTE_PATH.PLUGIN_SOURCES,
        component: PluginSources,
    },
    {
        path: ROUTE_PATH.BACKUP,
        component: Backup,
    },
    {
        path: ROUTE_PATH.PLUGIN_SORT,
        component: PluginSort,
    },
    {
        path: ROUTE_PATH.SHEET_MANAGER,
        component: SheetManager,
    },
    {
        path: ROUTE_PATH.API_SHEET_DETAIL,
        component: ApiSheetDetail,
    },
    {
        path: ROUTE_PATH.SOUND_EFFECT,
        component: SoundEffectSetting,
    },
];
