import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import useOrientation from "@/hooks/useOrientation";
import rpx, { vh } from "@/utils/rpx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    DeviceEventEmitter,
    KeyboardAvoidingView,
    NativeEventSubscription,
    Pressable,
    StyleSheet,
} from "react-native";
import Animated, {
    Easing,
    EasingFunction,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { panelInfoStore } from "../usePanel";
import NativeUtils from "@/native/utils";
import { useAtomValue } from "jotai";
import { fullPlayingAtom } from "@/core/tabletNav";

const ANIMATION_EASING: EasingFunction = Easing.out(Easing.exp);
const ANIMATION_DURATION = 250;

const timingConfig = {
    duration: ANIMATION_DURATION,
    easing: ANIMATION_EASING,
};

/** 平板内容区顶部 tab 栏高度（与 TabBar horizontal 一致，对齐 APlayer 56dp） */
const TAB_BAR_HEIGHT = 56;

interface IPanelBaseProps {
    keyboardAvoidBehavior?: "height" | "padding" | "position" | "none";
    height?: number;
    // 定位方式
    positionMethod?: "top" | "bottom";
    renderBody: (loading: boolean) => JSX.Element;
}

export default function (props: IPanelBaseProps) {
    const {
        height = vh(60),
        renderBody,
        keyboardAvoidBehavior,
        positionMethod = "bottom",
    } = props;
    const snapPoint = useSharedValue(0);

    const colors = useColors();
    const [loading, setLoading] = useState(true); // 是否处于弹出状态
    const timerRef = useRef<any>();
    const safeAreaInsets = useSafeAreaInsets();
    const orientation = useOrientation();
    const useAnimatedBase = useMemo(
        () => (orientation === "horizontal" ? rpx(750) : height),
        [orientation],
    );

    const backHandlerRef = useRef<NativeEventSubscription>();

    const hideCallbackRef = useRef<Function[]>([]);

    useEffect(() => {
        snapPoint.value = withTiming(1, timingConfig);

        timerRef.current = setTimeout(() => {
            if (loading) {
                // 兜底
                setLoading(false);
            }
        }, 400);
        if (backHandlerRef.current) {
            backHandlerRef.current.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                snapPoint.value = withTiming(0, timingConfig);
                // 硬件返回键主动收起：丢弃 showPanel→hidePanel 排队的链式换层回调，
                // 避免 250ms 收起动画窗口内按返回，动画结束后排队 callback 仍把新面板弹出
                hideCallbackRef.current = [];
                return true;
            },
        );

        const listenerSubscription = DeviceEventEmitter.addListener(
            "hidePanel",
            (arg?: (() => void) | { immediate?: boolean; callback?: () => void }) => {
                const callback =
                    typeof arg === "function" ? arg : arg?.callback;
                const immediate =
                    typeof arg !== "function" ? arg?.immediate : false;
                if (callback) {
                    hideCallbackRef.current.push(callback);
                }
                // immediate：跳过收起动画直接到 0，避免遮罩残留叠在新浮窗下层
                snapPoint.value = immediate
                    ? 0
                    : withTiming(0, timingConfig);
            },
        );

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
            listenerSubscription.remove();
        };
    }, []);

    const maskAnimated = useAnimatedStyle(() => {
        return {
            opacity: snapPoint.value * 0.5,
        };
    });

    // 平板：遮罩与面板限制在右内容区（左 30% 播放区 + 顶部 tab 栏不被遮挡）。
    // 例外：全屏播放层激活时（全项目唯一全屏覆盖），面板/遮罩全屏——任意点面板外均可关闭
    const isTablet = useIsTablet();
    const fullPlaying = useAtomValue(fullPlayingAtom);
    const tabletBound =
        isTablet && !fullPlaying
            ? {
                left: "30%" as const,
                width: "70%" as const,
                top: TAB_BAR_HEIGHT,
                bottom: 0,
            }
            : null;

    const panelAnimated = useAnimatedStyle(() => {
        return {
            transform: [
                orientation === "vertical"
                    ? {
                        translateY: (1 - snapPoint.value) * useAnimatedBase,
                    }
                    : {
                        translateX: (1 - snapPoint.value) * useAnimatedBase,
                    },
            ],
        };
    }, [orientation]);

    const mountPanel = useCallback(() => {
        setLoading(false);
    }, []);

    const unmountPanel = useCallback(() => {
        panelInfoStore.setValue({
            name: null,
            payload: null,
        });
        hideCallbackRef.current.forEach(cb => cb?.());
    }, []);

    useAnimatedReaction(
        () => snapPoint.value,
        (result, prevResult) => {
            if (
                ((prevResult !== null && result > prevResult) ||
                    prevResult === null) &&
                result > 0.8
            ) {
                runOnJS(mountPanel)();
            }

            if (prevResult && result < prevResult && result === 0) {
                runOnJS(unmountPanel)();
            }
        },
        [],
    );

    const panelBody = (
        <Animated.View
            style={[
                style.wrapper,
                tabletBound ? { left: "30%", width: "70%" } : null,
                orientation === "horizontal"
                    ? tabletBound
                        ? {
                            // 与遮罩 tabletBound 对齐：顶边落在 tab 栏之下（top=56），
                            // 避免面板压住顶部 4-tab 栏
                            top: TAB_BAR_HEIGHT,
                            bottom: 0,
                        }
                        : {
                            height: vh(100) - safeAreaInsets.top,
                            bottom: 0,
                        }
                    : {
                        top: positionMethod === "top" ? (NativeUtils.getWindowDimensions().height + safeAreaInsets.top) - height - safeAreaInsets.bottom : undefined,
                        bottom: positionMethod === "bottom" ? 0 : undefined,
                        height: height,
                    },
                {
                    backgroundColor: colors.backdrop,
                },
                panelAnimated,
            ]}>
            {renderBody(loading)}
        </Animated.View>
    );

    return (
        <>
            {/* 全屏触摸拦截层（Pressable 覆盖 100% 整屏，含左播放区与顶部 tab 栏）：
                点击任意面板外区域（含左播放区/播放条）关闭浮窗，不再穿透进全屏——
                与视觉暗色层分离：暗色仍限右内容区（不压暗播放区，tabletBound 设计保留） */}
            <Pressable
                style={style.maskWrapper}
                onPress={() => {
                    snapPoint.value = withTiming(0, timingConfig);
                }}>
                <Animated.View
                    style={[
                        style.maskWrapper,
                        style.mask,
                        tabletBound ? style.tabletBound : null,
                        maskAnimated,
                    ]}
                />
            </Pressable>
            {keyboardAvoidBehavior === "none" ? (
                panelBody
            ) : (
                <KeyboardAvoidingView
                    // 全屏 absolute 容器叠在 mask 拦截层之上：必须 box-none（自身不接触摸、子级面板正常接收），
                    // 否则无处理器的全屏 View 会挡住 mask 的 onPress、点面板外无法关闭浮窗（对齐 panelFullscreen.tsx:162 同款范式）
                    pointerEvents="box-none"
                    style={style.kbContainer}
                    behavior={keyboardAvoidBehavior || "position"}>
                    {panelBody}
                </KeyboardAvoidingView>
            )}
        </>
    );
}

const style = StyleSheet.create({
    maskWrapper: {
        position: "absolute",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15000,
        // Android 绘制顺序由 elevation 决定（RN zIndex 不跨父容器生效）：
        // 无 elevation 时页面内带 elevation 的元素（如播放条 MusicBar=6）会画在
        // 遮罩/面板之上，导致点击穿透、面板被盖住（对称 ef98369 的 Dialog 侧修复）；
        // 遮罩 15300 / 面板 15310，保持 Panel < Dialog(16300) 的层级语义
        elevation: 15300,
    },
    mask: {
        backgroundColor: "#000",
        opacity: 0.5,
    },
    /** 平板：限制在右内容区（左播放区 + 顶部 tab 不遮挡） */
    tabletBound: {
        left: "30%",
        width: "70%",
        top: TAB_BAR_HEIGHT,
        bottom: 0,
    },
    wrapper: {
        position: "absolute",
        width: rpx(750),
        right: 0,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        // 裁剪子内容到顶部圆角内：标题（PanelHeader 直角渐变）等子视图为直角矩形，
        // 不裁剪时直角边缘在圆角处外露，视觉上呈"圆角处直角阴影/直角角块"。
        // Android elevation 阴影基于 View outline（圆角 outline），overflow hidden 不影响阴影显示。
        overflow: "hidden",
        zIndex: 15010,
        elevation: 15310,
    },
    kbContainer: {
        // 与 Dialog backContainer(ef98369 / 717b872) 同构：必须 position absolute + 全屏 100%，
        // elevation(15310) 才在 Android 生效、把整个面板子树抬到全屏 Pressable 拦截层(15300)之上。
        // 此前 kbContainer 无 position/无尺寸(0x0)，elevation 不生效，面板子树仍落在普通绘制序，
        // 被已 elevation 的全屏暗色拦截层盖住 → 实测只显示一片阴影、面板内容不可见。
        // 全屏 absolute 后它叠在 mask 之上：触控穿透由外层 KeyboardAvoidingView 的
        // pointerEvents="box-none" 保证（自身不接触摸、子级面板正常），面板外点击仍达 mask 关闭浮窗。
        position: "absolute",
        width: "100%",
        height: "100%",
        zIndex: 15010,
        elevation: 15310,
    },
});
