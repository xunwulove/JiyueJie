import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import { ListDivider } from "@/components/base/divider";
import MusicList from "@/components/musicList";
import { localMusicSheetId, RequestStateCode } from "@/constants/commonConst";
import LocalMusicSheet from "@/core/localMusicSheet";
import { useParams } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

/** 本地音乐分组页 - 专辑 / 歌手 / 文件夹 三视图（对齐 APlayer AlbumCoverList / ArtistCoverList 行式） */

type GroupType = "album" | "artist" | "folder";

interface IGroup {
    name: string;
    musicList: IMusic.IMusicItem[];
}

function getGroupKey(music: IMusic.IMusicItem, type: GroupType): string {
    if (type === "album") {
        return music.album || "未知专辑";
    }
    if (type === "artist") {
        return music.artist || "未知歌手";
    }
    const localPath = (music as any)?.["$"]?.localPath as string | undefined;
    if (localPath) {
        const idx = localPath.lastIndexOf("/");
        return localPath.slice(0, Math.max(idx, 0)) || "根目录";
    }
    return "未知目录";
}

function groupMusicList(
    musicList: IMusic.IMusicItem[],
    type: GroupType,
): IGroup[] {
    const map = new Map<string, IMusic.IMusicItem[]>();
    for (const music of musicList) {
        const key = getGroupKey(music, type);
        const list = map.get(key);
        if (list) {
            list.push(music);
        } else {
            map.set(key, [music]);
        }
    }
    return Array.from(map.entries())
        .map(([name, list]) => ({ name, musicList: list }))
        .sort((a, b) => b.musicList.length - a.musicList.length);
}

const TITLES: Record<GroupType, string> = {
    album: "专辑",
    artist: "歌手",
    folder: "文件夹",
};

/** 行图标：专辑 album-outline（圆角10块）/ 歌手 user（圆形块）/ 文件夹 folder-outline（圆角10块），对齐 APlayer Album/Person */
const GROUP_ICONS: Record<GroupType, "album-outline" | "user" | "folder-outline"> = {
    album: "album-outline",
    artist: "user",
    folder: "folder-outline",
};

export default function LocalGroup() {
    const { groupType } = useParams<"local-group">();
    const colors = useColors();
    const musicList = LocalMusicSheet.useMusicList();
    const [selectedGroup, setSelectedGroup] = useState<IGroup | null>(null);

    const groups = useMemo(
        () => groupMusicList(musicList ?? [], groupType),
        [musicList, groupType],
    );

    const gradientColors = [
        Color(colors.primary).alpha(0.16).toString(),
        Color(colors.primary).alpha(0.04).toString(),
    ];
    const iconColor = Color(colors.primary).alpha(0.5).toString();

    return (
        <SafeAreaView edges={["bottom", "top"]} style={styles.wrapper}>
            <StatusBar />
            <AppBar>
                {selectedGroup ? selectedGroup.name : TITLES[groupType]}
            </AppBar>
            {selectedGroup ? (
                <View style={styles.musicListWrapper}>
                    <MusicList
                        musicList={selectedGroup.musicList}
                        showIndex
                        state={RequestStateCode.IDLE}
                        musicSheet={{
                            id: localMusicSheetId,
                            title: selectedGroup.name,
                            platform: "local",
                            musicList: selectedGroup.musicList,
                        }}
                    />
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    showsVerticalScrollIndicator={false}>
                    {groups.length === 0 ? (
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            style={styles.empty}>
                            暂无本地音乐
                        </ThemeText>
                    ) : (
                        groups.map(group => (
                            <View key={group.name}>
                                <Pressable
                                    onPress={() => setSelectedGroup(group)}>
                                    {/* 行：48dp 渐变图标块（专辑圆角10 / 歌手圆）+ 组名 15 Medium + "N 首" 12 + Play 18 α0.7 */}
                                    <View style={styles.row}>
                                        <LinearGradient
                                            colors={gradientColors}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[
                                                styles.iconBlock,
                                                groupType === "artist"
                                                    ? styles.iconBlockRound
                                                    : null,
                                            ]}>
                                            <Icon
                                                name={GROUP_ICONS[groupType]}
                                                size={26}
                                                color={iconColor}
                                            />
                                        </LinearGradient>
                                        <View style={styles.info}>
                                            <ThemeText
                                                fontSize="body"
                                                fontWeight="medium"
                                                numberOfLines={1}>
                                                {group.name}
                                            </ThemeText>
                                            <ThemeText
                                                fontSize="description"
                                                fontColor="textSecondary"
                                                numberOfLines={1}>
                                                {group.musicList.length} 首
                                            </ThemeText>
                                        </View>
                                        <Icon
                                            name="play"
                                            size={18}
                                            color={Color(colors.primary)
                                                .alpha(0.7)
                                                .toString()}
                                        />
                                    </View>
                                </Pressable>
                                <ListDivider marginLeft={68} />
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    empty: {
        textAlign: "center",
        marginTop: rpx(120),
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    iconBlock: {
        width: 48,
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    iconBlockRound: {
        borderRadius: 24,
    },
    info: {
        flex: 1,
        marginRight: 8,
    },
    musicListWrapper: {
        flex: 1,
    },
});
