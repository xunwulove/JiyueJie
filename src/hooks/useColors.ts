import { Theme, useTheme } from "@react-navigation/native";
import Color from "color";
import { useMemo } from "react";

type IColors = Theme["colors"];

export interface CustomizedColors extends IColors {
    /** 普通文字 */
    text: string;
    /** 副标题文字颜色 */
    textSecondary?: string;
    /** 高亮文本颜色，也就是主色调 */
    textHighlight?: string;
    /** 页面背景 */
    pageBackground?: string;
    /** 白天背景顶部微蓝起点（方案A：PageBackground 渐变到底部 pageBackground） */
    pageBackgroundTop?: string;
    /** 阴影 */
    shadow?: string;
    /** 标题栏颜色 */
    appBar?: string;
    /** 标题栏字体颜色 */
    appBarText?: string;
    /** 音乐栏颜色 */
    musicBar?: string;
    /** 音乐栏字体颜色 */
    musicBarText?: string;
    /** 分割线 */
    divider?: string;
    /** 高亮颜色 */
    listActive?: string;
    /** 输入框背景色 */
    placeholder?: string;
    /** 弹窗、浮层、菜单背景色 */
    backdrop?: string;
    /** 卡片背景色 */
    card: string;
    /** 椒盐 surfaceVariant（卡片灰调底，对齐 APlayer #F1F5F9 / #334155） */
    surfaceVariant?: string;
    /** paneltabbar 背景色 */
    tabBar?: string;
}

export default function useColors() {
    const { colors } = useTheme();

    const cColors: CustomizedColors = useMemo(() => {
        return {
            ...colors,
            // textSecondary 对齐 APlayer onSurfaceVariant（主题已定义）；自定义主题缺省时回退 α0.7
            textSecondary:
                (colors as any).textSecondary ??
                Color(colors.text).alpha(0.7).toString(),
            // @ts-ignore
            background: colors.pageBackground ?? colors.background,
        };
    }, [colors]);

    return cColors;
}
