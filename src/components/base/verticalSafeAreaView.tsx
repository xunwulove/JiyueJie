import React, { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useIsTablet from "@/hooks/useIsTablet";

interface IVerticalSafeAreaViewProps {
    mode?: "margin" | "padding";
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}
export default function VerticalSafeAreaView(
    props: IVerticalSafeAreaViewProps,
) {
    const { children, style, mode } = props;
    const isTablet = useIsTablet();
    // 平板：二级页渲染在右内容区覆盖层内，外层 home 已做 SafeArea top/bottom，
    // 此处只保 bottom，避免标题行再下移状态栏高度（与其他二级页 StatusBar+AppBar 贴顶一致）
    return (
        <SafeAreaView
            style={style}
            mode={mode}
            edges={isTablet ? ["bottom"] : ["top", "bottom"]}>
            {children}
        </SafeAreaView>
    );
}
