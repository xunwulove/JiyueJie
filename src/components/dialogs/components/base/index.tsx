import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import {
    BackHandler,
    NativeEventSubscription,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";
import { vh } from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import { useAtomValue } from "jotai";
import { fullPlayingAtom } from "@/core/tabletNav";
import ThemeText from "@/components/base/themeText";
import { ScrollView } from "react-native-gesture-handler";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";

/** 平板内容区顶部 tab 栏高度（与 TabBar horizontal 一致，对齐 APlayer 56dp） */
const TAB_BAR_HEIGHT = 56;

interface IDialogProps {
    onDismiss?: () => void;
    children?: ReactNode;
    /** 返回手势/键拦截：返回 true 表示自行处理（如目录逐级回退），本次不关闭浮窗 */
    onBackPress?: () => boolean;
}

function Dialog(props: IDialogProps) {
    const { children, onDismiss, onBackPress } = props;

    const sharedShowValue = useSharedValue(0);
    const colors = useColors();
    const backHandlerRef = useRef<NativeEventSubscription>();
    // 最新回调引用：返回监听器注册一次（effect []），始终读取当前渲染的最新 onBackPress/onDismiss（修复陈旧闭包，如勾选状态不持久化）
    const onDismissRef = useRef(onDismiss);
    const onBackPressRef = useRef(onBackPress);
    onDismissRef.current = onDismiss;
    onBackPressRef.current = onBackPress;
    // 平板：弹窗限制在右内容区（左 30% 播放区 + 顶部 tab 栏不被遮挡）；
    // 全屏播放层激活时（fullPlaying）整屏居中——与 panelBase 的 tabletBound 语义对齐，
    // 否则平板全屏播放页弹出的弹窗仍落进右 70% 盒（中心偏右约 15% 屏宽 + 顶部多 56dp）
    const isTablet = useIsTablet();
    const fullPlaying = useAtomValue(fullPlayingAtom);
    const tabletBound = isTablet && !fullPlaying;

    // 对话框宽度（对齐 APlayer Level3Dialog：平板 = 内容区宽 60%，手机 = 屏宽 86%）
    // 平板全屏播放时弹窗宽度跟随外面弹窗（60% 限定），不因 fullPlaying 放大为 86%：
    // 全屏播放层只改弹窗位置（整屏居中），不改弹窗宽度
    const dialogContainerStyle: ViewStyle =
        isTablet
            ? {
                width: "60%",
            }
            : {
                width: "86%",
            };

    useEffect(() => {
        sharedShowValue.value = 1;
        if (backHandlerRef.current) {
            backHandlerRef.current?.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                // 组件可自行拦截（返回 true 表示已处理，不关闭浮窗）
                if (onBackPressRef.current?.()) {
                    return true;
                }
                onDismissRef.current?.();
                return true;
            },
        );

        return () => {
            sharedShowValue.value = 0;
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
        };
    }, []);

    const containerStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(
                sharedShowValue.value,
                timingConfig.animationFast,
            ),
        };
    });

    const scaleAnimationStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    scale: withTiming(
                        0.9 + sharedShowValue.value * 0.1,
                        timingConfig.animationFast,
                    ),
                },
            ],
        };
    });

    return (
        <>
            {/* 全屏触摸拦截层：覆盖 100% 整屏（含左播放区），点击任意非弹窗区域=关闭浮窗，
                不再穿透触发下层进全屏导航（tabletPanel playContent onPress）。
                拦截层 elevation 0901 位于弹窗本体（dialogContainer elevation 0909）之下，
                弹窗按钮可正常点击，仅非弹窗区域命中本层；纯透明不显示暗色（平板不遮挡播放区视觉） */}
            <TouchableWithoutFeedback onPress={onDismiss}>
                <View style={styles.screenTouchBlock} />
            </TouchableWithoutFeedback>
            <View
                style={[
                    styles.backContainer,
                    tabletBound
                        ? {
                            left: "30%",
                            width: "70%",
                            top: TAB_BAR_HEIGHT,
                            bottom: 0,
                            height: undefined,
                        }
                        : null,
                ]}>
                {/* 弹窗外区域点击=关闭：覆盖 backContainer 全区域（平板右 70% 内容区 / 全屏播放页整屏），
                    垫在淡入层与弹窗本体之下（zIndex 默认 0 < 0901/0909）。
                    此前该区域命中 backContainer 空容器（无响应者）导致点击不退出；
                    点击弹窗本体（dialogContainer 0909 在上）不触发本层，点击外部命中本层=关闭 */}
                <TouchableWithoutFeedback onPress={onDismiss}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>
                {/* 视觉淡入层（纯动画，不可交互）：淡入淡出由 containerStyle 驱动；pointerEvents none
                    避免全屏透明层拦截命中下方的关闭层。
                    无暗色遮罩：弹窗直接浮在当前页面上（保留透明点击层，点弹窗外部空白仍可关闭） */}
                <Animated.View
                    pointerEvents="none"
                    style={[styles.container, containerStyle]}
                />
                <Animated.View
                    style={[
                        styles.dialogContainer,
                        dialogContainerStyle,
                        scaleAnimationStyle,
                        {
                            backgroundColor: colors.backdrop,
                            shadowColor: colors.shadow,
                        },
                    ]}>
                    {children}
                </Animated.View>
            </View>
        </>
    );
}

interface IDialogTitleProps {
    children?: ReactNode;
    withDivider?: boolean;
    stringContent?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
}

function Title(props: IDialogTitleProps) {
    const { children, withDivider, stringContent, containerStyle } = props;
    const colors = useColors();

    return (
        <>
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.10).toString(),
                    Color(
                        (colors as any).primaryContainer ?? colors.primary,
                    )
                        .alpha(0.07)
                        .toString(),
                    "rgba(0,0,0,0.016)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.titleContainer, containerStyle]}>
                {/* 蓝色胶囊竖条（对齐 APlayer Level3Dialog 4×20dp 圆角2） */}
                <View
                    style={[
                        styles.titleCapsule,
                        { backgroundColor: colors.primary },
                    ]}
                />
                <View style={styles.titleTextWrap}>
                    {typeof children === "string" || stringContent ? (
                        <ThemeText
                            fontSize="title"
                            fontWeight="bold"
                            numberOfLines={1}>
                            {children}
                        </ThemeText>
                    ) : (
                        children
                    )}
                </View>
            </LinearGradient>
            {withDivider ? (
                /* 淡蓝分割线（对齐 APlayer primary α0.12 / 0.6dp） */
                <View
                    style={[
                        styles.titleDivider,
                        { backgroundColor: Color(colors.primary)
                            .alpha(0.12)
                            .toString() },
                    ]}
                />
            ) : null}
        </>
    );
}

interface IDialogContentProps {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    needScroll?: boolean;
}

function Content(props: IDialogContentProps) {
    const { children, style, needScroll } = props;

    const content =
        typeof children === "string" ? (
            <ThemeText
                fontSize="content"
                fontColor="textSecondary"
                style={styles.defaultFontStyle}>
                {children}
            </ThemeText>
        ) : (
            children
        );

    return (
        <View
            style={[
                styles.contentContainer,
                {
                    // 内容区高度上限统一用数值（vh），
                    // 避免 Android 上百分比 maxHeight 因父容器高度未定时失效导致弹窗超高/底部异常
                    maxHeight: vh(70),
                    flexShrink: 1,
                },
                style,
            ]}>
            {needScroll ? (
                <ScrollView
                    contentContainerStyle={{
                        paddingBottom: 0,
                    }}>
                    {content}
                </ScrollView>
            ) : (
                content
            )}
        </View>
    );
}

interface IDialogActionsProps {
    children?: ReactNode;
    actions?: Array<{
        title: string;
        type?: "normal" | "primary";
        show?: boolean;
        onPress?: () => void;
    }>;
    style?: StyleProp<ViewStyle>;
}

function Actions(props: IDialogActionsProps) {
    const { children, style, actions } = props;
    const colors = useColors();

    const validActions = useMemo(
        () => actions?.filter(it => it.show !== false),
        [actions],
    );

    const _children = validActions?.length ? (
        <>
            {validActions.map((it, index) =>
                it.show === false ? null : (
                    <BottomButton
                        key={index}
                        style={index === 0 ? null : styles.actionButton}
                        onPress={it.onPress}
                        text={it.title}
                        type={it.type}
                    />
                ),
            )}
        </>
    ) : (
        children
    );

    return (
        <>
            {/* 底部按钮行：上方淡蓝分割线 + 品牌渐变底（与标题行同高同渐变，上下对称） */}
            <View
                style={[
                    styles.actionsDivider,
                    { backgroundColor: Color(colors.primary)
                        .alpha(0.12)
                        .toString() },
                ]}
            />
            <LinearGradient
                colors={[
                    Color(colors.primary).alpha(0.10).toString(),
                    Color(
                        (colors as any).primaryContainer ?? colors.primary,
                    )
                        .alpha(0.07)
                        .toString(),
                    "rgba(0,0,0,0.016)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.actionsContainer, style]}>
                {typeof children === "string" ? (
                    <ThemeText fontSize="content" numberOfLines={1}>
                        {children}
                    </ThemeText>
                ) : (
                    _children
                )}
            </LinearGradient>
        </>
    );
}

function BottomButton(props: {
    type?: "normal" | "primary";
    text: string;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}) {
    const { type = "normal", text, style, onPress } = props;
    const colors = useColors();

    return (
        <TouchableOpacity
            activeOpacity={0.6}
            onPress={onPress}
            style={[styles.bottomBtn, style]}>
            <ThemeText
                fontSize="subTitle"
                fontWeight="medium"
                color={
                    type === "normal" ? colors.textSecondary : colors.primary
                }>
                {text}
            </ThemeText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bottomBtn: {
        flex: 1,
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
        height: 52,
    },
    backContainer: {
        position: "absolute",
        zIndex: 905, // 概念编码 0905（JS 数值去前导零）
        // Android 原生绘制顺序由 elevation 决定（RN zIndex 不跨父容器生效）：
        // 页面内带 elevation 的元素（如播放条 MusicBar elevation=6）会盖过无 elevation 的遮罩，
        // 导致点击穿透（如点击播放条误进全屏播放器且浮窗不关闭）；
        // 层级编码规范：主层 09 弹窗层——拦截层 0901 / 容器 0905 / 本体 0909，elevation 与 zIndex 同值
        elevation: 905,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    container: {
        // 层级编码规范：弹窗层容器内淡入层 0905（backContainer 内：关闭层 0 < 淡入层 0905 < 本体 0909）
        zIndex: 905, // 概念编码 0905（JS 数值去前导零）
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        // 无遮盖：弹窗直接浮在当前页面上（保留透明点击层，点弹窗外部空白仍可关闭）
        backgroundColor: "transparent",
    },
    /** 全屏触摸拦截层：与 backContainer 同级同 elevation（0901）、渲染在前
     *  → backContainer（弹窗本体）触摸优先，弹窗外任意区域（含左播放区）命中本层=关闭。
     *  纯透明不显示暗色：平板不遮挡左播放区视觉（tabletBound 设计保留）。
     *  层级编码规范：弹窗层拦截层 0901（主层 09） */
    screenTouchBlock: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 901, // 概念编码 0901（JS 数值去前导零）
        elevation: 901,
    },
    dialogContainer: {
        position: "absolute",
        width: "80%",
        zIndex: 909, // 概念编码 0909（JS 数值去前导零）
        borderRadius: 20, // 对齐 APlayer Level3Dialog 圆角 20dp
        borderWidth: 0.5, // 对齐 APlayer 细边框（outlineVariant α0.35）
        borderColor: "rgba(0,0,0,0.28)", // 2026-10-20 0.16→0.28：浅色下弹窗轮廓与渐变背景区分更清晰
        overflow: "hidden", // 渐变标题行/选项行为直角矩形，需裁剪以贴合弹窗圆角（避免圆角区露出底色）
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.35,
        shadowRadius: 10,

        // Android 触摸优先级由 elevation 决定：必须高于全屏拦截层 screenTouchBlock（901），
        // 否则弹窗本体触摸被拦截层抢走（弹窗选项点不到、点任意位置=关闭）。909 保证本体最上。
        elevation: 909,
    },

    defaultFontStyle: {
        fontSize: 13, // 对齐 APlayer Level3BodyText 13sp
        lineHeight: 21, // 对齐 APlayer 行高 21
    },

    /**** title */
    titleContainer: {
        height: 52, // 三级弹窗标题行（独立规范，对齐 APlayer Level3Dialog 52dp）
        width: "100%",
        alignItems: "center",
        justifyContent: "flex-start",
        flexDirection: "row",
        paddingHorizontal: 24,
    },
    titleCapsule: {
        width: 4,
        height: 20,
        borderRadius: 2,
        marginRight: 12,
    },
    titleTextWrap: {
        flex: 1,
    },
    titleDivider: {
        width: "100%",
        height: 0.6,
    },
    /** content */
    contentContainer: {
        width: "100%",
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 16,
    },
    /** actions */
    actionsContainer: {
        width: "100%",
        height: 52, // 三级弹窗按钮行（与标题行等高，独立规范）
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: 24,
        flexWrap: "nowrap",
    },
    actionsDivider: {
        width: "100%",
        height: 0.6,
    },
    actionButton: {
        marginLeft: 24,
    },
});

Dialog.Title = Title;
Dialog.Content = Content;
Dialog.Actions = Actions;

export default Dialog;
