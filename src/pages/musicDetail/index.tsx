import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { useCurrentMusic } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";

/**
 * 全屏播放页 - 对齐 APlayer PlayingPage：
 * 顶栏"正在播放"16sp；标题区（平板 32sp 歌名/18sp 歌手在左区，手机 19sp/13sp 在顶栏下）；
 * 平板左信息控制(6) + 右大封面(4)，4:6 分栏
 * 根容器任意触摸重置"沉浸歌词"无操作计时；沉浸层显示时覆盖全屏，触摸即退出
 */
export default function MusicDetail() {
    const orientation = useOrientation();
    const isTablet = orientation === "horizontal";
    const musicItem = useCurrentMusic();
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

    /* 标题区：歌名 + 歌手（对齐 APlayer：平板 32sp/18sp，手机 19sp/13sp） */
    const titleBlock = (
        <View style={styles.titleBlock}>
            <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={[
                    styles.songTitle,
                    isTablet ? styles.songTitleTablet : styles.songTitlePhone,
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
                    { color: colors.textSecondary },
                ]}>
                {musicItem?.artist}
            </Text>
        </View>
    );

    return (
        <Pressable
            style={globalStyle.fwflex1}
            onPressIn={() => {
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
    songTitle: {
        fontWeight: "700",
        includeFontPadding: false,
        textAlign: "center",
    },
    songTitleTablet: {
        fontSize: 32,
    },
    songTitlePhone: {
        fontSize: 19,
    },
    songArtist: {
        marginTop: 8,
        includeFontPadding: false,
        textAlign: "center",
    },
    songArtistTablet: {
        fontSize: 18,
    },
    songArtistPhone: {
        fontSize: 13,
        marginTop: 3,
    },
});
