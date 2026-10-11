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
import rpx, { vh } from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
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
    // 平板：弹窗限制在右内容区（左 30% 播放区 + 顶部 tab 栏不被遮挡）
    const isTablet = useIsTablet();

    // 对话框宽度（对齐 APlayer Level3Dialog：平板 = 内容区宽 60%，手机 = 屏宽 86%）
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
        <View
            style={[
                styles.backContainer,
                isTablet
                    ? {
                        left: "30%",
                        width: "70%",
                        top: TAB_BAR_HEIGHT,
                        bottom: 0,
                        height: undefined,
                    }
                    : null,
            ]}>
            <TouchableWithoutFeedback
                style={styles.container}
                onPress={onDismiss}>
                <Animated.View style={[styles.container, containerStyle]} />
            </TouchableWithoutFeedback>
            <Animated.View
                style={[
                    styles.dialogContainer,
                    dialogContainerStyle,
                    containerStyle,
                    scaleAnimationStyle,
                    {
                        backgroundColor: colors.backdrop,
                        shadowColor: colors.shadow,
                    },
                ]}>
                {children}
            </Animated.View>
        </View>
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
        zIndex: 16299,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    container: {
        zIndex: 16300,
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        // 无遮盖：弹窗直接浮在当前页面上（保留透明点击层，点弹窗外部空白仍可关闭）
        backgroundColor: "transparent",
    },
    dialogContainer: {
        position: "absolute",
        width: "80%",
        zIndex: 16310,
        borderRadius: 20, // 对齐 APlayer Level3Dialog 圆角 20dp
        borderWidth: 0.5, // 对齐 APlayer 细边框（outlineVariant α0.35）
        borderColor: "rgba(0,0,0,0.16)",
        overflow: "hidden", // 渐变标题行/选项行为直角矩形，需裁剪以贴合弹窗圆角（避免圆角区露出底色）
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.35,
        shadowRadius: 10,

        elevation: 8,
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
