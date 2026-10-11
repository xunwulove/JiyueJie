import Config from "@/core/appConfig";
import Toast from "@/utils/toast";
import { NativeModule, NativeModules } from "react-native";
import { errorLog } from "@/utils/log.ts";

export enum NativeTextAlignment {
    // 左对齐
    LEFT = 3,
    // 右对齐
    RIGHT = 5,
    // 居中
    CENTER = 17,
}

// 状态栏歌词的工具
interface ILyricUtil extends NativeModule {
    /** 显示状态栏歌词 */
    showStatusBarLyric: (
        initLyric?: string,
        config?: Record<string, any>,
    ) => Promise<void>;
    /** 隐藏状态栏歌词 */
    hideStatusBarLyric: () => Promise<void>;
    /** 设置歌词文本 */
    setStatusBarLyricText: (lyric: string) => Promise<void>;
    /** 设置距离顶部的距离 */
    setStatusBarLyricTop: (percent: number) => Promise<void>;
    /** 设置距离左部的距离 */
    setStatusBarLyricLeft: (percent: number) => Promise<void>;
    /** 设置宽度 */
    setStatusBarLyricWidth: (percent: number) => Promise<void>;
    /** 设置字体 */
    setStatusBarLyricFontSize: (fontSize: number) => Promise<void>;
    /** 设置对齐 */
    setStatusBarLyricAlign: (alignment: NativeTextAlignment) => Promise<void>;
    /** 设置颜色 */
    setStatusBarColors: (
        textColor: string | null,
        backgroundColor: string | null,
    ) => Promise<void>;
    /** 检查权限 */
    checkSystemAlertPermission: () => Promise<boolean>;
    /** 请求悬浮窗 */
    requestSystemAlertPermission: () => Promise<boolean>;
}

// iOS 侧无原生 LyricUtil 实现时 NativeModules.LyricUtil 为 undefined，
// 此处先补齐一组 no-op，避免模块加载期解引用方法导致 import 即崩
const defaultLyricUtil: ILyricUtil = {
    addListener: () => {},
    removeListeners: () => {},
    showStatusBarLyric: async () => Promise.resolve(),
    hideStatusBarLyric: () => Promise.resolve(),
    setStatusBarLyricText: () => Promise.resolve(),
    setStatusBarLyricTop: () => Promise.resolve(),
    setStatusBarLyricLeft: () => Promise.resolve(),
    setStatusBarLyricWidth: () => Promise.resolve(),
    setStatusBarLyricFontSize: () => Promise.resolve(),
    setStatusBarLyricAlign: () => Promise.resolve(),
    setStatusBarColors: () => Promise.resolve(),
    checkSystemAlertPermission: () => Promise.resolve(false),
    requestSystemAlertPermission: () => Promise.resolve(false),
};

const LyricUtil: ILyricUtil = NativeModules.LyricUtil
    ? { ...defaultLyricUtil, ...NativeModules.LyricUtil }
    : defaultLyricUtil;

const originalShowStatusBarLyric = LyricUtil.showStatusBarLyric;

const showStatusBarLyric: ILyricUtil["showStatusBarLyric"] = async (
    initLyric,
    config,
) => {
    if (typeof originalShowStatusBarLyric !== "function") {
        return;
    }
    try {
        await originalShowStatusBarLyric(initLyric, config);
    } catch (e) {
        errorLog("状态栏歌词开启失败", e);
        Toast.warn("状态栏歌词开启失败，请到手机系统设置打开悬浮窗权限");
        Config.setConfig("lyric.showStatusBarLyric", false);
    }
};

LyricUtil.showStatusBarLyric = showStatusBarLyric;

export default LyricUtil;
