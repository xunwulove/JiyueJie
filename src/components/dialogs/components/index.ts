import CheckStorage from "@/components/dialogs/components/checkStorage.tsx";
import DownloadDialog from "./downloadDialog";
import EditSheetDetailDialog from "./editSheetDetail";
import LoadingDialog from "./loadingDialog";
import MarkdownDialog from "./markdownDialog";
import RadioDialog from "./radioDialog";
import SimpleDialog from "./simpleDialog";
import SetScheduleCloseTimeDialog from "./setScheduleCloseTimeDialog";
import CreateMusicSheetDialog from "./createMusicSheetDialog";
import AddToMusicSheetDialog from "./addToMusicSheetDialog";
import DownloadSettingsDialog from "./downloadSettingsDialog";
import ImportMusicSheetDialog from "./importMusicSheetDialog";
import MenuDialog from "./menuDialog";
import FileSelectorDialog from "./fileSelectorDialog";
import MusicListEditorDialog from "./musicListEditorDialog";
import ThemeSettingDialog from "./themeSettingDialog";
import SoundEffectQuickDialog from "./soundEffectQuickDialog";
import TimingCloseDialog from "./timingCloseDialog";
import SetFontSizeDialog from "./setFontSizeDialog";
import SubscriptionSettingDialog from "./subscriptionSettingDialog";
import PermissionSettingDialog from "./permissionSettingDialog";
import UpdateDownloadDialog from "./updateDownloadDialog";
import LyricSettingDialog from "./lyricSettingDialog";
import SortDialog from "./sortDialog";
import ImmersiveSettingDialog from "./immersiveSettingDialog";
import VolumeSettingDialog from "./volumeSettingDialog";
import LyricColorDialog from "./lyricColorDialog";
import RecommendSourceDialog from "./recommendSourceDialog";
import ImageViewerDialog from "./imageViewerDialog";
import SimpleInputDialog from "./simpleInputDialog";
import WebDAVSettingDialog from "./webdavSettingDialog";
import MusicItemOptionsDialog from "./musicItemOptionsDialog";
import MusicItemLyricOptionsDialog from "./musicItemLyricOptionsDialog";
import MusicQualityDialog from "./musicQualityDialog";
import PluginSettingDialog from "./pluginSettingDialog";
import CoverBasePositionDialog from "./coverBasePositionDialog";
import PluginReliabilityDialog from "./pluginReliabilityDialog";

const dialogs = {
    SimpleDialog,
    RadioDialog,
    DownloadDialog,
    LoadingDialog,
    EditSheetDetailDialog,
    CheckStorage,
    MarkdownDialog,
    SetScheduleCloseTimeDialog,
    CreateMusicSheetDialog,
    AddToMusicSheetDialog,
    DownloadSettingsDialog,
    ImportMusicSheetDialog,
    MenuDialog,
    FileSelectorDialog,
    MusicListEditorDialog,
    ThemeSettingDialog,
    SoundEffectQuickDialog,
    TimingCloseDialog,
    SetFontSizeDialog,
    SubscriptionSettingDialog,
    PermissionSettingDialog,
    UpdateDownloadDialog,
    LyricSettingDialog,
    SortDialog,
    ImmersiveSettingDialog,
    VolumeSettingDialog,
    LyricColorDialog,
    RecommendSourceDialog,
    ImageViewerDialog,
    SimpleInputDialog,
    WebDAVSettingDialog,
    MusicItemOptionsDialog,
    MusicItemLyricOptionsDialog,
    MusicQualityDialog,
    PluginSettingDialog,
    CoverBasePositionDialog,
    PluginReliabilityDialog,
};

export default dialogs;

export type IDialogType = typeof dialogs;
export type IDialogKey = keyof IDialogType;
