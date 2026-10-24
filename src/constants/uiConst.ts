import { CustomizedColors } from "@/hooks/useColors";

// 字号对齐旧项目 APlayer（Compose sp → RN dp，默认字体缩放 1.0 时数值一致）：
// 角标 10sp / 小标签·副行 11sp / 辅助 12sp / 列表项·歌单名 13sp / 次要 14sp / 卡片文字 15sp /
// 正文·区块标题 16sp / 标题 18sp / 大数字 22sp；旧项目平板/手机字号一致，不随屏幕放大
const fontSizeConst = {
    /** 角标/播放量（旧 10sp） */
    tag: 10,
    /** 小标签/歌单副行/统计手机标签（旧 11sp） */
    caption: 11,
    /** 描述/辅助文本/分类tab（旧 12sp） */
    description: 12,
    /** 列表项标题/歌单名/新歌标题（旧 13sp） */
    normal: 13,
    /** 副标题/次要文字（旧 14sp） */
    subTitle: 14,
    /** 卡片文字/播放按钮（旧 15sp） */
    body: 15,
    /** 正文/区块标题（旧 bodyLarge 16sp） */
    content: 16,
    /** 标题/卡片标题（旧 18sp） */
    title: 18,
    /** 大数字（统计/旧 titleLarge 22sp） */
    large: 22,
    /** 平板顶栏 Tab / 问候语大字号（旧 32sp，沉浸式大标题） */
    xlarge: 32,
    /** AppBar 标题（旧 CommonAppBar 18sp） */
    appbar: 18,
};

const fontWeightConst = {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    bolder: "800",
} as const;

const iconSizeConst = {
    small: 16,
    light: 20,
    normal: 24, // 对齐 APlayer 标准图标 24dp（AppBar/列表更多等）
    big: 32,
    large: 40,
};

type ColorKey = "normal" | "secondary" | "highlight" | "primary";
const colorMap: Record<ColorKey, keyof CustomizedColors> = {
    normal: "text",
    secondary: "textSecondary",
    highlight: "textHighlight",
    primary: "primary",
} as const;

export { fontSizeConst, fontWeightConst, iconSizeConst, colorMap };
export type { ColorKey };
