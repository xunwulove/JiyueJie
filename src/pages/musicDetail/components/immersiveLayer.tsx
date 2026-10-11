import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Animated,
    BackHandler,
    Dimensions,
    Easing,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import Svg, {
    Defs,
    RadialGradient as SvgRadialGradient,
    Rect,
    Stop,
} from "react-native-svg";
import ImageColors from "react-native-image-colors";
import Color from "color";
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
import { IParsedLrcItem } from "@/utils/lrcParser";
import useOrientation from "@/hooks/useOrientation";
import useColors from "@/hooks/useColors";
import KaraokeText from "@/components/base/karaokeText";
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
    // 反向光带（左→右，速度略慢于主光带）
    const flowAnim2 = useRef(new Animated.Value(0)).current;
    // 光斑呼吸动画值（0↔1 循环）
    const blobAnimA = useRef(new Animated.Value(0)).current;
    const blobAnimB = useRef(new Animated.Value(0)).current;
    // 流动光效循环动画句柄：退出/卸载时必须 stop，否则 native-driver 动画泄漏
    const flowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
    const flowLoop2Ref = useRef<Animated.CompositeAnimation | null>(null);
    const blobLoopARef = useRef<Animated.CompositeAnimation | null>(null);
    const blobLoopBRef = useRef<Animated.CompositeAnimation | null>(null);

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
    /* 光效配色跟随主题主色（白天品牌蓝 #2F6FED / 深色 #5A8FFF）；封面主色可用时优先（贴合歌曲氛围） */
    const colors = useColors();

    /* 封面主色提取：从当前歌曲封面异步取 2 个主色，失败/无封面回退主题主色 */
    const artwork = musicItem?.artwork;
    const [coverPalette, setCoverPalette] = useState<{
        cA: string;
        cB: string;
    } | null>(null);
    useEffect(() => {
        let cancelled = false;
        const primary = colors.primary;
        const fallbackB = Color(primary).rotate(42).saturate(0.15).hex();
        if (!artwork) {
            setCoverPalette({ cA: primary, cB: fallbackB });
            return;
        }
        setCoverPalette(null);
        ImageColors.getColors(artwork, {
            fallback: primary,
            cache: true,
            key: artwork,
        })
            .then(result => {
                if (cancelled) {
                    return;
                }
                // Android 平台字段：dominant/average/vibrant/darkVibrant/lightVibrant/muted
                const r = result as any;
                const cA =
                    r?.dominant ?? r?.average ?? r?.vibrant ?? primary;
                const cB =
                    r?.vibrant ??
                    r?.lightVibrant ??
                    r?.muted ??
                    fallbackB;
                setCoverPalette({ cA, cB });
            })
            .catch(() => {
                if (!cancelled) {
                    setCoverPalette({ cA: primary, cB: fallbackB });
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [artwork]);

    const blobColorA = coverPalette?.cA ?? colors.primary;
    const blobColorB = coverPalette?.cB ?? Color(colors.primary).rotate(42).saturate(0.15).hex();
    /* 主光带：封面主色/主题主色，透明度提升（00→42→2E→00）确保肉眼可见但不抢歌词 */
    const flowColors = [
        `${blobColorA}00`,
        `${blobColorA}42`,
        `${blobColorA}2E`,
        `${blobColorA}00`,
    ];
    /* 反向光带：第二主色系 */
    const flowColors2 = [
        `${blobColorB}00`,
        `${blobColorB}30`,
        `${blobColorB}1F`,
        `${blobColorB}00`,
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
            flowAnim2.setValue(0);
            flowLoop2Ref.current = Animated.loop(
                Animated.timing(flowAnim2, {
                    toValue: 1,
                    duration: 13000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            );
            flowLoop2Ref.current.start();
            const startBlobLoop = (
                anim: Animated.Value,
                ref: React.MutableRefObject<Animated.CompositeAnimation | null>,
                duration: number,
            ) => {
                ref.current = Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 1,
                            duration,
                            easing: Easing.inOut(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration,
                            easing: Easing.inOut(Easing.quad),
                            useNativeDriver: true,
                        }),
                    ]),
                );
                ref.current.start();
            };
            startBlobLoop(blobAnimA, blobLoopARef, 7000);
            startBlobLoop(blobAnimB, blobLoopBRef, 9500);
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
            flowLoop2Ref.current?.stop();
            flowLoop2Ref.current = null;
            flowAnim2.stopAnimation();
            blobLoopARef.current?.stop();
            blobLoopARef.current = null;
            blobAnimA.stopAnimation();
            blobLoopBRef.current?.stop();
            blobLoopBRef.current = null;
            blobAnimB.stopAnimation();
        };
    }, [visible, effect, fadeAnim, flowAnim, flowAnim2, blobAnimA, blobAnimB]);

    /* 歌词块进入动画：沉浸层出现时整体淡入（0.4s）；换行由 FlatList 滚动平滑完成，不再整体滑出 */
    const slideAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!visible) {
            return;
        }
        slideAnim.setValue(1);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [visible, slideAnim]);

    /* 歌词滚动（对齐全屏播放页）：当前行始终垂直居中，随播放平滑滚动 */
    const lyricListRef = useRef<FlatList<IParsedLrcItem> | null>(null);
    const [lyricAreaH, setLyricAreaH] = useState<number>();
    const lyricItemH = isTablet ? 44 : 36;
    const lyricBlankH = useMemo(
        () =>
            lyricAreaH
                ? Math.max((lyricAreaH - lyricItemH) / 2, 0)
                : 0,
        [lyricAreaH, lyricItemH],
    );
    useEffect(() => {
        if (!visible) {
            return;
        }
        const idx = currentLrcItem?.index ?? -1;
        const len = lyrics.length;
        if (idx < 0 || len === 0) {
            return;
        }
        const target = Math.min(idx, len - 1);
        lyricListRef.current?.scrollToIndex({
            index: target,
            viewPosition: 0.5,
            animated: true,
        });
    }, [visible, currentLrcItem?.index, lyrics.length]);

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

    /* 歌词：当前行索引（FlatList 滚动居中渲染用） */
    const curIndex = currentLrcItem?.index ?? -1;

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
    /* 反向光带：左→右，错开节奏 */
    const flowTranslate2 = flowAnim2.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_W * 0.8, SCREEN_W],
    });
    /* 光斑 A（左上半区）：位移 + 缩放呼吸 */
    const blobATranslateX = blobAnimA.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_W * 0.05, SCREEN_W * 0.04],
    });
    const blobATranslateY = blobAnimA.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_W * 0.03, SCREEN_W * 0.05],
    });
    const blobAScale = blobAnimA.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.32],
    });
    /* 光斑 B（右下半区）：反向位移 + 呼吸 */
    const blobBTranslateX = blobAnimB.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_W * 0.04, -SCREEN_W * 0.05],
    });
    const blobBTranslateY = blobAnimB.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_W * 0.03, -SCREEN_W * 0.04],
    });
    const blobBScale = blobAnimB.interpolate({
        inputRange: [0, 1],
        outputRange: [1.18, 0.92],
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

    /* 歌词流：FlatList 滚动（对齐全屏播放页）——当前行始终垂直居中、随播放平滑滚动，
       平板当前行 34sp/其余 25sp，手机当前 26sp/其余 15sp；进入时整块淡入 */
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
                <FlatList
                    ref={lyricListRef}
                    data={lyrics}
                    keyExtractor={(_, i) => `il-${i}`}
                    showsVerticalScrollIndicator={false}
                    overScrollMode="never"
                    initialNumToRender={30}
                    /* 边缘渐隐（对齐全屏播放页 fadingEdgeLength）：可视区上下边缘歌词微微隐入 */
                    fadingEdgeLength={isTablet ? 160 : 120}
                    style={styles.lyricList}
                    onLayout={e => setLyricAreaH(e.nativeEvent.layout.height)}
                    onScrollToIndexFailed={({ index }) => {
                        setTimeout(() => {
                            lyricListRef.current?.scrollToIndex({
                                index: Math.min(index, lyrics.length - 1),
                                viewPosition: 0.5,
                                animated: true,
                            });
                        }, 120);
                    }}
                    ListHeaderComponent={
                        <View style={{ height: lyricBlankH }} />
                    }
                    ListFooterComponent={
                        <View style={{ height: lyricBlankH }} />
                    }
                    renderItem={({ item, index }) => (
                        <View
                            style={[
                                styles.lyricRow,
                                { height: lyricItemH },
                            ]}>
                            {index === curIndex ? (
                                /* 卡拉OK进度染色当前行：已唱白色 0.98 / 未唱半透明白 0.5（去加粗，靠染色突出） */
                                <KaraokeText
                                    text={item.lrc}
                                    startTime={item.time}
                                    endTime={
                                        index + 1 < lyrics.length
                                            ? lyrics[index + 1].time
                                            : item.time + 15000
                                    }
                                    sungColor="rgba(255,255,255,0.98)"
                                    unsungColor="rgba(255,255,255,0.5)"
                                    fontSize={isTablet ? 34 : 26}
                                    lineHeight={lyricItemH}
                                />
                            ) : (
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.lyricSide,
                                        {
                                            fontSize: isTablet ? 25 : 15,
                                            lineHeight: lyricItemH,
                                        },
                                    ]}>
                                    {item.lrc}
                                </Text>
                            )}
                        </View>
                    )}
                />
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
                {/* 流光层：封面主色光斑呼吸 + 双渐变光带交错流动（纯 transform 动画，原生驱动） */}
                {effect ? (
                    <>
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.blob,
                                styles.blobA,
                                {
                                    transform: [
                                        { translateX: blobATranslateX },
                                        { translateY: blobATranslateY },
                                        { scale: blobAScale },
                                    ],
                                },
                            ]}>
                            <RadialBlob color={blobColorA} />
                        </Animated.View>
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.blob,
                                styles.blobB,
                                {
                                    transform: [
                                        { translateX: blobBTranslateX },
                                        { translateY: blobBTranslateY },
                                        { scale: blobBScale },
                                    ],
                                },
                            ]}>
                            <RadialBlob color={blobColorB} />
                        </Animated.View>
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
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.flowBand,
                                styles.flowBand2,
                                {
                                    transform: [{ translateX: flowTranslate2 }],
                                },
                            ]}>
                            <LinearGradient
                                colors={flowColors2}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>
                    </>
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
    flowBand2: {
        width: SCREEN_W * 0.55,
    },
    /* 封面主色光斑：大尺寸径向渐变圆，缓慢位移+缩放呼吸 */
    blob: {
        position: "absolute",
        width: SCREEN_W * 0.62,
        height: SCREEN_W * 0.62,
    },
    blobA: {
        left: -SCREEN_W * 0.18,
        top: -SCREEN_W * 0.1,
    },
    blobB: {
        right: -SCREEN_W * 0.16,
        bottom: -SCREEN_W * 0.14,
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
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    /* 平板歌词区扩大：上端贴歌名、底部与右侧封面底端齐平（封面 paddingBottom 64） */
    lyricWrapTablet: {
        paddingTop: 8,
        paddingBottom: 64,
    },
    /* FlatList 歌词流：占满歌词区，滚动时当前行垂直居中 */
    lyricList: {
        flex: 1,
        width: "100%",
    },
    /* 歌词行容器：固定行高 + 垂直居中（对齐全屏页 scrollToIndex 定位） */
    lyricRow: {
        alignItems: "center",
        justifyContent: "center",
    },
    lyricSide: {
        color: "rgba(255,255,255,0.5)",
        textAlign: "center",
        includeFontPadding: false,
    },
});

/** 径向渐变光斑（SVG）：中心不透明 → 边缘透明，作为封面主色呼吸光效的载体 */
function RadialBlob({ color }: { color: string }) {
    const gradientIdRef = useRef(`blob-${Math.random().toString(36).slice(2)}`);
    return (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
                <SvgRadialGradient
                    id={gradientIdRef.current}
                    cx="50%"
                    cy="50%"
                    r="50%">
                    <Stop offset="0%" stopColor={color} stopOpacity={0.5} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0} />
                </SvgRadialGradient>
            </Defs>
            <Rect
                width="100%"
                height="100%"
                fill={`url(#${gradientIdRef.current})`}
            />
        </Svg>
    );
}
