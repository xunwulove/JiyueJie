import Config from "@/core/appConfig";

import { DarkTheme as _DarkTheme, DefaultTheme as _DefaultTheme } from "@react-navigation/native";
import { GlobalState } from "@/utils/stateMapper";
import { CustomizedColors } from "@/hooks/useColors";
import Color from "color";
import { Appearance } from "react-native";

export const lightTheme = {
    id: "p-light",
    ..._DefaultTheme,
    colors: {
        ..._DefaultTheme.colors,
        background: "transparent",
        text: "#1E293B",
        // 对齐 APlayer onSurfaceVariant #64748B
        textSecondary: "#64748B",
        primary: "#2F6FED",
        pageBackground: "#F8F9FA",
        // 白天底部微蓝起点：PageBackground 顶部 pageBackground → 底部 pageBackgroundTop
        // 方向为"顶部白、底部浅蓝"（从下到上逐渐变白）；#EAF0FA 比原 #F2F5FC 深一档，保证渐变可感知
        pageBackgroundTop: "#EAF0FA",
        shadow: "#000",
        appBar: "#2F6FED",
        appBarText: "#FFFFFF",
        musicBar: "#FFFFFF",
        musicBarText: "#1E293B",
        divider: "#E2E8F0",
        listActive: "rgba(0,0,0,0.1)", // 在手机上表现是ripple
        mask: "rgba(30,41,59,0.2)",
        backdrop: "#FFFFFF",
        // 椒盐 surfaceVariant 卡片灰调底（对齐 APlayer #F1F5F9）
        surfaceVariant: "#F1F5F9",
        tabBar: "#F8F9FA",
        placeholder: "#F1F5F9",
        success: "#08A34C",
        danger: "#EF4444",
        info: "#0A95C8",
        card: "#FFFFFF",
        notification: "#FFFFFF",
    },
};

export const darkTheme = {
    id: "p-dark",
    ..._DarkTheme,
    colors: {
        ..._DarkTheme.colors,
        background: "transparent",
        text: "#E2E8F0",
        // 对齐 APlayer 深色 onSurfaceVariant #94A3B8
        textSecondary: "#94A3B8",
        primary: "#5A8FFF",
        pageBackground: "#0F172A",
        // 深色渐变底部端点：顶部 pageBackground(深黑) → 底部 pageBackgroundTop(深蓝灰)，
        // 与白天"底部品牌色氛围"方向一致；从下到上逐渐变深（顶部最深）
        pageBackgroundTop: "#182848",
        shadow: "#999",
        appBar: "#2F6FED",
        appBarText: "#FFFFFF",
        musicBar: "#1E293B",
        musicBarText: "#E2E8F0",
        divider: "#334155",
        listActive: "rgba(255,255,255,0.1)", // 在手机上表现是ripple
        mask: "rgba(15,23,42,0.8)",
        backdrop: "#1E293B",
        // 椒盐 surfaceVariant 卡片灰调底（对齐 APlayer #334155）
        surfaceVariant: "#334155",
        tabBar: "#0F172A",
        placeholder: "#334155",
        success: "#08A34C",
        // 对齐 APlayer 深色 error #F87171
        danger: "#F87171",
        info: "#0A95C8",
        card: "#1E293B",
        notification: "#1E293B",
    },
};

interface IBackgroundInfo {
    url?: string;
    blur?: number;
    opacity?: number;
}

// 软件默认为白天模式（对齐旧项目默认浅色）
const themeStore = new GlobalState(lightTheme);
const backgroundStore = new GlobalState<IBackgroundInfo | null>(null);

function setup() {
    let currentTheme = Config.getConfig("theme.selectedTheme") ?? "p-light";

    // 跟随系统时：按系统当前配色确定初始主题，
    // 避免冷启动首帧用错误主题渲染后再切换（主题闪烁）
    if (Config.getConfig("theme.followSystem")) {
        currentTheme =
            Appearance.getColorScheme() === "dark" ? "p-dark" : "p-light";
    }

    if (currentTheme === "p-dark") {
        themeStore.setValue(darkTheme);
    } else if (currentTheme === "p-light") {
        themeStore.setValue(lightTheme);
    } else {
        themeStore.setValue({
            id: currentTheme,
            dark: true,
            // @ts-ignore
            colors:
                (Config.getConfig("theme.colors") as CustomizedColors) ??
                darkTheme.colors,
        });
    }

    const bgUrl = Config.getConfig("theme.background");
    const bgBlur = Config.getConfig("theme.backgroundBlur");
    const bgOpacity = Config.getConfig("theme.backgroundOpacity");

    backgroundStore.setValue({
        url: bgUrl,
        blur: bgBlur ?? 20,
        opacity: bgOpacity ?? 0.6,
    });
}

function setTheme(
    themeName: string,
    extra?: {
        colors?: Partial<CustomizedColors>;
        background?: IBackgroundInfo;
    },
) {
    if (themeName === "p-light") {
        themeStore.setValue(lightTheme);
    } else if (themeName === "p-dark") {
        themeStore.setValue(darkTheme);
    } else {
        themeStore.setValue({
            id: themeName,
            dark: true,
            colors: {
                ...darkTheme.colors,
                ...(extra?.colors ?? {}),
            },
        });
    }

    Config.setConfig("theme.selectedTheme", themeName);
    Config.setConfig("theme.colors", themeStore.getValue().colors);

    if (extra?.background) {
        const currentBg = backgroundStore.getValue();
        let newBg: IBackgroundInfo = {
            blur: 20,
            opacity: 0.6,
            ...(currentBg ?? {}),
            url: undefined,
        };
        if (typeof extra.background.blur === "number") {
            newBg.blur = extra.background.blur;
        }
        if (typeof extra.background.opacity === "number") {
            newBg.opacity = extra.background.opacity;
        }
        if (extra.background.url) {
            newBg.url = extra.background.url;
        }

        Config.setConfig("theme.background", newBg.url);
        Config.setConfig("theme.backgroundBlur", newBg.blur);
        Config.setConfig("theme.backgroundOpacity", newBg.opacity);

        backgroundStore.setValue(newBg);
    }
}

function setColors(colors: Partial<CustomizedColors>) {
    const currentTheme = themeStore.getValue();
    if (currentTheme.id !== "p-light" && currentTheme.id !== "p-dark") {
        const newTheme = {
            ...currentTheme,
            colors: {
                ...currentTheme.colors,
                ...colors,
            },
        };
        Config.setConfig("theme.colors", newTheme.colors);
        themeStore.setValue(newTheme);
    }
}

function setBackground(backgroundInfo: Partial<IBackgroundInfo>) {
    const currentBackgroundInfo = backgroundStore.getValue();
    let newBgInfo = {
        ...(currentBackgroundInfo ?? {
            opacity: 0.6,
            blur: 20,
        }),
    };
    if (typeof backgroundInfo.blur === "number") {
        Config.setConfig("theme.backgroundBlur", backgroundInfo.blur);
        newBgInfo.blur = backgroundInfo.blur;
    }
    if (typeof backgroundInfo.opacity === "number") {
        Config.setConfig("theme.backgroundOpacity", backgroundInfo.opacity);
        newBgInfo.opacity = backgroundInfo.opacity;
    }
    // 用 in 判断而非 !== undefined：调用方传 { url: undefined } 表示"清除背景"，
    // 值比较会把 undefined 当"未提供"而跳过清除分支（清除无效根因）
    if ("url" in backgroundInfo) {
        Config.setConfig("theme.background", backgroundInfo.url);
        newBgInfo.url = backgroundInfo.url;
    }
    backgroundStore.setValue(newBgInfo);
}

const configableColorKey: Array<keyof CustomizedColors> = [
    "primary",
    "text",
    "appBar",
    "appBarText",
    "musicBar",
    "musicBarText",
    "pageBackground",
    "backdrop",
    "card",
    "placeholder",
    "tabBar",
    "notification",
];


const Theme = {
    setup,
    setTheme,
    setBackground,
    setColors,
    useTheme: themeStore.useValue,
    getTheme: themeStore.getValue,
    useBackground: backgroundStore.useValue,
    configableColorKey,
};

export default Theme;
