import CheckStorage from "@/components/dialogs/components/checkStorage.tsx";
import LoadingDialog from "./loadingDialog";
import MarkdownDialog from "./markdownDialog";
import RadioDialog from "./radioDialog";
import SimpleDialog from "./simpleDialog";
import MenuDialog from "./menuDialog";
import FileSelectorDialog from "./fileSelectorDialog";
import SimpleInputDialog from "./simpleInputDialog";
import SubscriptionSettingDialog from "./subscriptionSettingDialog";
import PluginSettingDialog from "./pluginSettingDialog";

const dialogs = {
    SimpleDialog,
    RadioDialog,
    LoadingDialog,
    CheckStorage,
    MarkdownDialog,
    MenuDialog,
    FileSelectorDialog,
    SimpleInputDialog,
    SubscriptionSettingDialog,
    PluginSettingDialog,
};

export default dialogs;

export type IDialogType = typeof dialogs;
export type IDialogKey = keyof IDialogType;
