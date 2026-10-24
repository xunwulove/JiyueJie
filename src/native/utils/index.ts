import { NativeModule, NativeModules } from "react-native";

interface INativeUtils extends NativeModule {
    exitApp: () => void;
    checkStoragePermission: () => Promise<boolean>;
    requestStoragePermission: () => void;
    installApk: (apkPath: string) => Promise<boolean>;
    getWindowDimensions: () => { width: number, height: number }; // Fix bug: https://github.com/facebook/react-native/issues/47080
    /** 开机自启动开关（车机/平板常电场景）：写入原生标记供 BootReceiver 开机读取 */
    setAutoBootEnabled: (enabled: boolean) => void;
    /** 开机自启动开关当前状态（同步读） */
    isAutoBootEnabled: () => boolean;
    /** 桌面快捷方式冷启动兜底：读取并清空 pending action（无则 null） */
    consumePendingShortcutAction: () => string | null;
}

const NativeUtils = NativeModules.NativeUtils;

export default NativeUtils as INativeUtils;
