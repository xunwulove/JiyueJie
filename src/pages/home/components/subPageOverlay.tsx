import React, { useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { routes } from "@/core/router/routes";
import { TabletFrameParamsProvider } from "@/core/router";
import {
    popTabletSubPage,
    tabletSubPagesAtom,
} from "@/core/tabletNav";
import rpx, { vw } from "@/utils/rpx";
import useColors from "@/hooks/useColors";

/**
 * 平板二级页面：
 * - 一级页面（tab 内容）点击 → 二级页面：右内容区内从右滑入的全宽覆盖层（不盖 tab、不盖左播放区）
 * - 二级页面内再点击 → 三级浮窗：由 Dialog 系统实现（showDialog，内容区中心缩放浮窗）
 * - 栈式导航：Android 返回键逐级 pop
 */
export default function SubPageOverlay() {
    const subPages = useAtomValue(tabletSubPagesAtom);
    const setSubPages = useSetAtom(tabletSubPagesAtom);
    const colors = useColors();

    // Android 返回键：逐级关闭
    useEffect(() => {
        if (subPages.length === 0) {
            return;
        }
        const sub = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                setSubPages(prev => popTabletSubPage(prev));
                return true;
            },
        );
        return () => sub.remove();
    }, [subPages.length]);

    if (subPages.length === 0) {
        return null;
    }

    return (
        <>
            {subPages.map((page, idx) => {
                const routeDef = routes.find(r => r.path === page.path);
                if (!routeDef) {
                    return null;
                }
                const Component = routeDef.component;
                // 路由页面全部为二级页面（右内容区覆盖层）：
                // 三级浮窗由 Dialog 系统实现（showDialog），不再按栈深把页面误渲染为弹窗
                return (
                    <FullOverlay
                        key={page.key}
                        backgroundColor={colors.background}>
                        {/* 本帧参数注入：帧内 useParams 只消费本帧 params，不被栈顶污染 */}
                        <TabletFrameParamsProvider value={page.params}>
                            <Component />
                        </TabletFrameParamsProvider>
                    </FullOverlay>
                );
            })}
        </>
    );
}

/** 二级页面：右内容区全宽，从右滑入 */
function FullOverlay({
    children,
    backgroundColor,
}: {
    children: React.ReactNode;
    backgroundColor: string;
}) {
    const progress = useSharedValue(0);
    // 注意：vw() 是普通 JS 函数，不能在 worklet 内调用（reanimated UI 线程无此函数），先算成常量
    const slideDistance = vw(100) * 0.7;
    useEffect(() => {
        progress.value = 0;
        progress.value = withTiming(1, { duration: 240 });
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: (1 - progress.value) * slideDistance },
        ],
    }));

    return (
        <Animated.View
            style={[
                StyleSheet.absoluteFill,
                animatedStyle,
                { zIndex: 1000, backgroundColor },
            ]}>
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    mask: {
        zIndex: 1100,
        backgroundColor: "#000000",
    },
    modalCenter: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1101,
        alignItems: "center",
        justifyContent: "center",
    },
    modal: {
        overflow: "hidden",
    },
});
