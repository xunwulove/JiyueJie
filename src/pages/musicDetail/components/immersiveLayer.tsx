import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Animated,
    BackHandler,
    Dimensions,
    Easing,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import { useAppConfig } from "@/core/appConfig";
import {
    MusicState,
    useCurrentMusic,
    useMusicState,
} from "@/core/trackPlayer";
import {
    useCurrentLyricItem,
    useLyricState,
} from "@/core/lyricManager";
import { getCurrentDialog } from "@/components/dialogs/useDialog";
import { panelInfoStore } from "@/components/panels/usePanel";
import useOrientation from "@/hooks/useOrientation";
import useColors from "@/hooks/useColors";
import { fontWeightConst } from "@/constants/uiConst";

const { width: SCREEN_W } = Dimensions.get("window");

/** 模块级触摸重置钩子：MusicDetail 根容器任意触摸时调用，重置无操作计时 */
export const immersiveTouch = {
    reset: () => {},
};

/**
 * 沉浸歌词层（样式 A，对齐 QQ音乐 HD 沉浸歌词页布局）：
 * 全屏播放页无操作 N 秒（默认 15s，可设置）后自动进入；
 * 内容 = 现有歌词系统数据（歌词里有啥展示啥，不额外造数据）；
 * 布局 = 平板/横屏左 60% 歌词（当前行大字+上下行） + 右 40% 右下封面，
 *         手机/竖屏顶部歌名歌手 + 居中歌词；
 * 背景 = 深色渐变 + 缓慢流动光效；任意触摸或返回键退出。
 */
export default function ImmersiveLayer() {
    // 自动进入沉浸歌词默认开启；设置页可关闭
    const enable = useAppConfig("basic.immersiveEnable") ?? true;
    const delay = useAppConfig("basic.immersiveDelay") ?? 15;
    const effect = useAppConfig("basic.immersiveEffect") ?? true;

    const [visible, setVisible] = useState(false);
    // exiting：退出淡出动画期间仍保留渲染树（淡出需附着目标），动画完成后才真正卸载
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const flowAnim = useRef(new Animated.Value(0)).current;
    // 流动光效循环动画句柄：退出/卸载时必须 stop，否则 native-driver 动画泄漏
    const flowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    const musicItem = useCurrentMusic();
    const { lyrics } = useLyricState();
    const currentLrcItem = useCurrentLyricItem();
    // 仅播放中计时：暂停/停止/缓冲/加载均不计时（对齐 QQ音乐"播放15秒后进入沉浸歌词"）。
    // 注意：不可用「负向 isPaused」判定——Android 上 RNTP 暂停后 state 常见为 Ready 而非 Paused，
    // 负向判定会漏判导致暂停时计时器不清除、15s 后仍进入沉浸层。
    const musicState = useMusicState();
    const isPlaying = musicState === MusicState.Playing;
    // 实时播放态 ref：计时器回调闭包内读取（避免闭包持有启动时的旧值）
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);
    const orientation = useOrientation();
    const insets = useSafeAreaInsets();
    // 当前北京时间（右上角时间显示，每分钟变化）
    const [now, setNow] = useState(() => new Date());

    const isTablet = orientation === "horizontal";
    /* 光带颜色跟随主题主色（白天品牌蓝 #2F6FED / 深色 #5A8FFF，hex+alpha 后缀） */
    const colors = useColors();
    const flowColors = [
        `${colors.primary}00`,
        `${colors.primary}14`,
        `${colors.primary}24`,
        `${colors.primary}00`,
    ];

    /* 重置计时：任意触摸后重新计算无操作时长；仅播放中计时（暂停/停止/缓冲不启动） */
    const reset = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!enable) {
            return;
        }
        // 仅播放中计时（正向判定）：暂停/停止/缓冲/加载不计时；恢复播放后由 prevPlayingRef effect 重启计时
        if (!isPlaying) {
            return;
        }
        timerRef.current = setTimeout(() => {
            // 弹窗/面板打开期间不进入沉浸层：顺延重新计时，关闭后恢复，不丢失自动进入
            if (getCurrentDialog()?.name || panelInfoStore.getValue().name) {
                reset();
                return;
            }
            // 触发时二次校验：计时期间已暂停/停止则不进入，重新等待播放
            if (!isPlayingRef.current) {
                reset();
                return;
            }
            setVisible(true);
        }, (delay ?? 15) * 1000);
    }, [enable, delay, isPlaying]);

    useEffect(() => {
        immersiveTouch.reset = reset;
        // 挂载时立即启动无操作计时（此前只在触摸时 reset，进入页面后不触摸则永远不进入）
        reset();
        return () => {
            immersiveTouch.reset = () => {};
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [reset]);

    /* P2-03：播放由非播放态恢复（paused/buffering → playing）时显式重启无操作计时。
       此前恢复播放仅依赖 reset 身份变化触发挂载 effect 重建的隐式链路；
       若退出沉浸层时处于非播放态，reset 会提前 return 不计时，恢复后可能漏重启。 */
    const prevPlayingRef = useRef(isPlaying);
    useEffect(() => {
        if (!prevPlayingRef.current && isPlaying) {
            reset();
        }
        prevPlayingRef.current = isPlaying;
    }, [isPlaying, reset]);

    /* 退出沉浸层：先进入 exiting 保留渲染树播放淡出（淡出需附着目标），动画完成后再真正卸载并重启计时 */
    const exitingRef = useRef(false);
    const hide = useCallback(() => {
        if (exitingRef.current) {
            return;
        }
        exitingRef.current = true;
        setExiting(true);
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            exitingRef.current = false;
            setVisible(false);
            setExiting(false);
            // 触摸被沉浸层自身拦截，下层 MusicDetail 的 onPressIn 收不到 reset；
            // 退出后手动重启无操作计时，保证之后仍能自动进入
            reset();
        });
    }, [fadeAnim, reset]);

    /* BackHandler 经 hideRef 始终调用最新 hide，避免闭包持旧 hide；
       show effect 不依赖 hide，reset/isPlaying 变化不会重跑淡入造成闪烁 */
    const hideRef = useRef(hide);
    useEffect(() => {
        hideRef.current = hide;
    }, [hide]);

    /* 显示：淡入 + 启动光效循环 + 返回键退出沉浸层 */
    useEffect(() => {
        if (!visible) {
            return;
        }
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
        if (effect) {
            flowAnim.setValue(0);
            flowLoopRef.current = Animated.loop(
                Animated.timing(flowAnim, {
                    toValue: 1,
                    duration: 9000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            );
            flowLoopRef.current.start();
        }
        const sub = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                hideRef.current();
                return true;
            },
        );
        return () => {
            sub.remove();
            flowLoopRef.current?.stop();
            flowLoopRef.current = null;
            flowAnim.stopAnimation();
        };
    }, [visible, effect, fadeAnim, flowAnim]);

    /* 歌词切换平滑动画：新歌词从下方滑入 + 淡入（避免硬切换）
       【重要】hooks 必须在组件顶层调用（return null 之前），
       否则 visible 切换时 hook 数量变化会导致 React 渲染崩溃 */
    const slideAnim = useRef(new Animated.Value(0)).current;
    const prevLrcIndexRef = useRef(-1);
    useEffect(() => {
        if (!visible) {
            return;
        }
        const idx = currentLrcItem?.index ?? -1;
        if (prevLrcIndexRef.current !== idx && idx >= 0) {
            slideAnim.setValue(1);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 320,
                useNativeDriver: true,
            }).start();
        }
        prevLrcIndexRef.current = idx;
    }, [currentLrcItem?.index, slideAnim, visible]);

    /* 沉浸层显示期间每秒刷新北京时间 */
    useEffect(() => {
        if (!visible) {
            return;
        }
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, [visible]);

    /* 真正卸载时机：visible=false 且不在退出淡出动画中（exiting 期间保留渲染树供淡出附着）。
       必须位于全部 hooks 之后（hooks 顺序恒定，不可条件调用）。 */
    if (!visible && !exiting) {
        return null;
    }

    /* 歌词：当前行居中，上下行小字（内容来自现有歌词系统） */
    const curIndex = currentLrcItem?.index ?? -1;
    const curLrc =
        curIndex >= 0 && curIndex < lyrics.length
            ? lyrics[curIndex].lrc
            : "";

    const hasLyric = lyrics.length > 0;

    /* 右上角当前北京时间（HH:mm，对齐 QQ音乐 HD 沉浸页） */
    const timeText = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
    ).padStart(2, "0")}`;

    /* 光带从右侧屏外（+W）扫到左侧屏外（-W），全程经过屏幕内部 */
    const flowTranslate = flowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_W, -SCREEN_W],
    });

    /* 顶部歌名 + 歌手 */
    const headerBlock = (
        <View style={styles.headerBlock}>
            <Text
                numberOfLines={1}
                style={[
                    styles.headerTitle,
                    { fontSize: isTablet ? 24 : 18 },
                ]}>
                {musicItem?.title ?? "--"}
            </Text>
            <Text
                numberOfLines={1}
                style={[
                    styles.headerArtist,
                    { fontSize: isTablet ? 16 : 14 },
                ]}>
                {musicItem?.artist}
            </Text>
        </View>
    );

    /* 歌词流：当前行居中 + 上下多行（平板各3行、手机各2行），内容来自现有歌词系统 */
    const sideCount = isTablet ? 3 : 2;
    const upLines: { text: string; key: string }[] = [];
    for (let i = sideCount; i >= 1; i--) {
        const idx = curIndex - i;
        upLines.push({
            key: `up-${i}`,
            text: idx >= 0 && idx < lyrics.length ? lyrics[idx].lrc : "",
        });
    }
    const downLines: { text: string; key: string }[] = [];
    for (let i = 1; i <= sideCount; i++) {
        const idx = curIndex + i;
        downLines.push({
            key: `down-${i}`,
            text: idx >= 0 && idx < lyrics.length ? lyrics[idx].lrc : "",
        });
    }

    /* 歌词切换平滑动画：新歌词从下方滑入 + 淡入（避免硬切换）——hooks 已上移组件顶层 */
    const lyricBlock = (
        <Animated.View
            style={[
                {
                    opacity: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                    }),
                    transform: [
                        {
                            translateY: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 28],
                            }),
                        },
                    ],
                },
                styles.lyricWrap,
                isTablet ? styles.lyricWrapTablet : null,
            ]}>
            {hasLyric ? (
                <>
                    {upLines.map(l => (
                        <Text
                            key={l.key}
                            numberOfLines={1}
                            style={[
                                styles.lyricSide,
                                { fontSize: isTablet ? 25 : 15 },
                            ]}>
                            {l.text}
                        </Text>
                    ))}
                    <Text
                        numberOfLines={2}
                        style={[
                            styles.lyricCurrent,
                            {
                                fontSize: isTablet ? 34 : 26,
                                lineHeight: isTablet ? 44 : 34,
                            },
                        ]}>
                        {curLrc || "♪"}
                    </Text>
                    {downLines.map(l => (
                        <Text
                            key={l.key}
                            numberOfLines={1}
                            style={[
                                styles.lyricSide,
                                { fontSize: isTablet ? 25 : 15 },
                            ]}>
                            {l.text}
                        </Text>
                    ))}
                </>
            ) : (
                <Text
                    style={[
                        styles.lyricSide,
                        { fontSize: isTablet ? 25 : 15 },
                    ]}>
                    暂无歌词
                </Text>
            )}
        </Animated.View>
    );

    /* 右下封面（仅平板/横屏左右分栏时展示）；无封面时显示可见占位 */
    const coverBlock = isTablet ? (
        <View style={styles.coverPane}>
            {musicItem?.artwork ? (
                <Image
                    source={{ uri: musicItem.artwork }}
                    style={styles.cover}
                    resizeMode="cover"
                />
            ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Text style={styles.coverPlaceholderText}>♪</Text>
                </View>
            )}
        </View>
    ) : null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <Pressable
                style={styles.pressArea}
                onPress={hide}
                onPressIn={hide}>
                {/* 深色渐变背景（完全不透明，不透出后层） */}
                <LinearGradient
                    colors={[
                        "#0A0C12",
                        "#080A10",
                        "#05060A",
                    ]}
                    style={StyleSheet.absoluteFill}
                />
                {/* 缓慢流动光效：横向渐变光带由右向左缓慢流动 */}
                {effect ? (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.flowBand,
                            {
                                transform: [{ translateX: flowTranslate }],
                            },
                        ]}>
                        <LinearGradient
                            colors={flowColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                ) : null}

                {isTablet ? (
                    /* 平板/横屏：顶部行（左60%歌名居中 | 右40%时间居中，同高度）+ 左 60% 歌词 + 右 40% 右下封面 */
                    <View style={styles.bodyRow}>
                        <View
                            style={[
                                styles.topRow,
                                { paddingTop: (insets.top ?? 0) + 24 },
                            ]}>
                            <View style={styles.topLeft}>
                                {headerBlock}
                            </View>
                            <View style={styles.topRight}>
                                <Text style={styles.topTime}>{timeText}</Text>
                            </View>
                        </View>
                        <View style={styles.contentRow}>
                            <View style={styles.leftPane}>{lyricBlock}</View>
                            {coverBlock}
                        </View>
                    </View>
                ) : (
                    /* 手机/竖屏：顶部歌名歌手居中 + 右上时间 + 居中歌词 */
                    <View style={styles.bodyCol}>
                        <View
                            style={[
                                styles.headerPhone,
                                { paddingTop: (insets.top ?? 0) + 24 },
                            ]}>
                            {headerBlock}
                        </View>
                        <Text
                            style={[
                                styles.topTimePhone,
                                { top: (insets.top ?? 0) + 32 },
                            ]}>
                            {timeText}
                        </Text>
                        {lyricBlock}
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15000,
        overflow: "hidden",
    },
    pressArea: {
        flex: 1,
    },
    flowBand: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: SCREEN_W * 0.8,
        left: 0,
    },
    /* 平板：左右分栏 */
    bodyRow: {
        flex: 1,
        flexDirection: "column",
    },
    /* 顶部行：左 60%（歌名+歌手居中）| 右 40%（时间居中），同高度（对齐 QQ音乐 HD） */
    topRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 4, // 歌词区上端更贴近歌名/作者
    },
    topLeft: {
        flex: 6,
        alignItems: "center",
        paddingLeft: 40,
        paddingRight: 16,
    },
    topRight: {
        flex: 4,
        alignItems: "center",
        paddingRight: 40,
    },
    topTime: {
        color: "rgba(255,255,255,0.85)",
        fontSize: 50, // 平板右上角时间
        fontWeight: fontWeightConst.medium,
        includeFontPadding: false,
    },
    /* 内容区：左 60% 歌词 + 右 40% 封面 */
    contentRow: {
        flex: 1,
        flexDirection: "row",
    },
    leftPane: {
        flex: 6,
        paddingLeft: 40,
        paddingRight: 24,
    },
    coverPane: {
        flex: 4,
        alignItems: "center",
        justifyContent: "flex-end",
        paddingRight: 48,
        paddingBottom: 64,
    },
    cover: {
        width: "78%",
        aspectRatio: 1,
        borderRadius: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    coverPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
    },
    coverPlaceholderText: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 56,
        fontWeight: fontWeightConst.medium,
    },
    /* 手机：纵向 */
    bodyCol: {
        flex: 1,
    },
    /* 顶部歌名歌手 */
    headerBlock: {
        alignItems: "center",
    },
    headerPhone: {
        alignItems: "center",
        paddingHorizontal: 24,
    },
    topTimePhone: {
        position: "absolute",
        right: 24,
        color: "rgba(255,255,255,0.85)",
        fontSize: 14,
        fontWeight: fontWeightConst.medium,
        includeFontPadding: false,
    },
    headerTitle: {
        color: "rgba(255,255,255,0.95)",
        fontWeight: fontWeightConst.medium,
        includeFontPadding: false,
    },
    headerArtist: {
        color: "rgba(255,255,255,0.6)",
        marginTop: 6,
        includeFontPadding: false,
    },
    /* 歌词 */
    lyricWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    /* 平板歌词区扩大：上端贴歌名、底部与右侧封面底端齐平（封面 paddingBottom 64） */
    lyricWrapTablet: {
        paddingTop: 8,
        paddingBottom: 64,
    },
    lyricSide: {
        color: "rgba(255,255,255,0.5)",
        textAlign: "center",
        marginVertical: 8,
        includeFontPadding: false,
    },
    lyricCurrent: {
        color: "rgba(255,255,255,0.98)",
        fontWeight: fontWeightConst.bold,
        textAlign: "center",
        marginVertical: 8,
        includeFontPadding: false,
    },
});
