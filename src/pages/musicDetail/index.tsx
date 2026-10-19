import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import React, { useEffect } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Background from "./components/background";
import Bottom from "./components/bottom";
import Content from "./components/content";
import AlbumCover from "./components/content/albumCover";
import NavBar from "./components/navBar";
import ImmersiveLayer, {
    immersiveTouch,
} from "./components/immersiveLayer";
import Config from "@/core/appConfig";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useCurrentMusic, useMusicQuality } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { qualityText } from "@/utils/qualities";

/**
 * 全屏播放页 - 对齐 APlayer PlayingPage：
 * 顶栏"正在播放"16sp；标题区（平板 32sp 歌名/18sp 歌手在左区，手机 19sp/13sp 在顶栏下）；
 * 平板左信息控制(6) + 右大封面(4)，4:6 分栏
 * 根容器任意触摸重置"沉浸歌词"无操作计时；沉浸层显示时覆盖全屏，触摸即退出
 *
 * 弹性：窗口高 < 600dp（手机横屏 ~390dp / 分屏矮窗）时标题区/控制行走紧凑档，
 * 避免固定 dp 堆叠溢出；平板 800dp+ 视觉不受影响
 */
export default function MusicDetail() {
    const orientation = useOrientation();
    const isTablet = orientation === "horizontal";
    const { height: winH } = useWindowDimensions();
    const compact = winH < 600;
    const musicItem = useCurrentMusic();
    const quality = useMusicQuality();
    const colors = useColors();

    useEffect(() => {
        const needAwake = Config.getConfig("basic.musicDetailAwake");
        if (needAwake) {
            activateKeepAwakeAsync();
        }
        return () => {
            if (needAwake) {
                deactivateKeepAwake();
            }
        };
    }, []);

    /* 标题区：歌名 + 歌手（对齐 APlayer：平板 32sp/18sp，手机 19sp/13sp；矮横屏紧凑档 24sp/15sp） */
    const titleBlock = (
        <View
            style={[
                styles.titleBlock,
                compact && styles.titleBlockCompact,
            ]}>
            <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={[
                    styles.songTitle,
                    isTablet
                        ? styles.songTitleTablet
                        : styles.songTitlePhone,
                    compact && styles.songTitleCompact,
                    { color: colors.text },
                ]}>
                {musicItem?.title ?? "--"}
            </Text>
            <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                    styles.songArtist,
                    isTablet ? styles.songArtistTablet : styles.songArtistPhone,
                    compact && styles.songArtistCompact,
                    { color: colors.textSecondary },
                ]}>
                {musicItem?.artist}
            </Text>
            {/* 当前音质标识：qualityText[当前音质]（无歌曲时随 musicItem 隐藏） */}
            {musicItem && (
                <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                        styles.qualityTag,
                        isTablet
                            ? styles.qualityTagTablet
                            : styles.qualityTagPhone,
                        compact && styles.qualityTagCompact,
                        { color: colors.textSecondary },
                    ]}>
                    {qualityText[quality]}
                </Text>
            )}
        </View>
    );

    return (
        <Pressable
            style={globalStyle.fwflex1}
            onTouchStart={() => {
                // onTouchStart 为冒泡合成事件：任意触摸（含按钮/滑动/沉浸层自身）都重置无操作计时；
                // 不能用 onPressIn（responder 机制，内层按钮触摸不触发）
                immersiveTouch.reset();
            }}>
            <Background />
            <SafeAreaView style={globalStyle.fwflex1}>
                <StatusBar backgroundColor={"transparent"} />
                {isTablet ? (
                    // 平板横屏：左信息控制(6) + 右大封面(4)，复刻 APlayer
                    <View style={styles.bodyWrapper}>
                        <View style={styles.leftPane}>
                            <NavBar />
                            {titleBlock}
                            <View style={globalStyle.flex1}>
                                <Content />
                            </View>
                            <Bottom />
                        </View>
                        <View style={styles.rightPane}>
                            <AlbumCover />
                        </View>
                    </View>
                ) : (
                    <View style={styles.bodyWrapper}>
                        <View style={globalStyle.flex1}>
                            <NavBar />
                            {titleBlock}
                            <Content />
                            <Bottom />
                        </View>
                    </View>
                )}
            </SafeAreaView>
            {/* 沉浸歌词层：无操作自动进入，触摸/返回退出 */}
            <ImmersiveLayer />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bodyWrapper: {
        width: "100%",
        flex: 1,
        flexDirection: "row",
    },
    leftPane: {
        flex: 6,
    },
    rightPane: {
        flex: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    titleBlock: {
        paddingHorizontal: 48,
        alignItems: "center", // 歌名+作者顶端居中（对齐沉浸层顶部标题）
    },
    /* 矮屏（横屏高 <600dp）紧凑档：收紧标题区高度预算 */
    titleBlockCompact: {
        paddingHorizontal: 32,
    },
    songTitle: {
        fontWeight: "700",
        includeFontPadding: false,
        textAlign: "center",
    },
    songTitleTablet: {
        fontSize: 32,
        lineHeight: 44,
    },
    songTitlePhone: {
        fontSize: 19,
        lineHeight: 27,
    },
    /* 矮屏紧凑：24sp，行高 34 收紧 */
    songTitleCompact: {
        fontSize: 24,
        lineHeight: 34,
    },
    songArtist: {
        marginTop: 8,
        includeFontPadding: false,
        textAlign: "center",
    },
    songArtistTablet: {
        fontSize: 18,
        lineHeight: 26,
    },
    songArtistPhone: {
        fontSize: 13,
        marginTop: 3,
        lineHeight: 19,
    },
    /* 矮屏紧凑：15sp，行高 22 收紧 */
    songArtistCompact: {
        fontSize: 15,
        marginTop: 5,
        lineHeight: 22,
    },
    /* 当前音质标识：居中、小字、次级色（跟随歌名/歌手布局，不挤压标题） */
    qualityTag: {
        alignSelf: "center",
        includeFontPadding: false,
        textAlign: "center",
    },
    qualityTagTablet: {
        fontSize: 14,
        lineHeight: 20,
        marginTop: 6,
    },
    qualityTagPhone: {
        fontSize: 11,
        lineHeight: 16,
        marginTop: 4,
    },
    /* 矮屏紧凑：12sp，行高 17 收紧 */
    qualityTagCompact: {
        fontSize: 12,
        lineHeight: 17,
        marginTop: 3,
    },
});
