import React, { useEffect } from "react";
import { BackHandler, StyleSheet } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { vw } from "@/utils/rpx";
import PageBackground from "@/components/base/pageBackground";

/**
 * 平板二级页面：
 * - 一级页面（tab 内容）点击 → 二级页面：右内容区内从右滑入的全宽覆盖层（不盖 tab、不盖左播放区）
 * - 二级页面内再点击 → 三级浮窗：由 Dialog 系统实现（showDialog，内容区中心缩放浮窗）
 * - 栈式导航：Android 返回键逐级 pop
 * - 背景：覆盖层自绘一层 PageBackground（NavigationContainer 内拿到主题 → 与全局同款渐变）。
 *   必须自绘：覆盖层需不透明背景遮挡下方一级内容（否则一级图标/组件透出）；
 *   不透明渐变完全盖住全局层 → 视觉与一级 100% 一致，无氛围层叠加。
 *   （2026-10-13 两次修正：①全局层移入 NavigationContainer 内修复"一级纯色/二级渐变"不一致；
 *   ②曾误删覆盖层背景导致一级内容透出，已恢复）
 */
export default function SubPageOverlay() {
    const subPages = useAtomValue(tabletSubPagesAtom);
    const setSubPages = useSetAtom(tabletSubPagesAtom);

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
            {subPages.map(page => {
                const routeDef = routes.find(r => r.path === page.path);
                if (!routeDef) {
                    return null;
                }
                const Component = routeDef.component;
                // 路由页面全部为二级页面（右内容区覆盖层）：
                // 三级浮窗由 Dialog 系统实现（showDialog），不再按栈深把页面误渲染为弹窗
                return (
                    <FullOverlay key={page.key}>
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

/** 二级页面：右内容区全宽，从右滑入；背景 = 复用全局 PageBackground（与一级完全一致） */
function FullOverlay({ children }: { children: React.ReactNode }) {
    const progress = useSharedValue(0);
    const insets = useSafeAreaInsets();
    // 覆盖层左上角相对屏幕原点的偏移（背景图/渐变需按整屏几何渲染才能与全局背景完全重叠）：
    // top = 状态栏高度 + TabBar 固定高 56dp（对齐 APlayer）；left = 左播放面板宽（平板左侧 30%）
    const screenInsets = {
        top: insets.top + 56,
        left: vw(100) * 0.3,
    };
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
                { zIndex: 501 }, // 层级编码 0501（JS 数值去前导零）
            ]}>
            {/* 背景：覆盖层自绘 PageBackground（不透明渐变）——遮挡下方一级内容 + 与一级同款渐变；
                传入 screenInsets 后背景图/渐变按整屏几何渲染，与全局背景完全重叠（不错位） */}
            <PageBackground screenInsets={screenInsets} />
            {children}
        </Animated.View>
    );
}
