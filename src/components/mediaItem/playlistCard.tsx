import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Image from "@/components/base/image";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "@/components/base/themeText";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import useColors from "@/hooks/useColors";
import Icon from "@/components/base/icon.tsx";

/** 播放量格式化：≥1亿 → x.x亿，≥1万 → x.x万 */
export function formatPlayCount(count: number): string {
    if (count >= 100000000) {
        return `${(count / 100000000).toFixed(1)}亿`;
    }
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)}万`;
    }
    return `${count}`;
}

interface IPlaylistCardProps {
    title: string;
    artwork?: string;
    /** 播放量（>0 时显示右下角标） */
    playCount?: number;
    /** 副行文字（作者/来源/歌曲数） */
    subtitle?: string;
    onPress?: () => void;
    onLongPress?: () => void;
    /** 无封面时的占位图标名（传入 → 渐变底+图标，对齐 MyPlaylistCard；不传 → surfaceVariant 底，对齐首页 PlaylistCard） */
    placeholderIcon?: "playlist" | "heart" | "musical-note";
}

/**
 * 歌单卡 - 复刻 APlayer PlaylistCard / MyPlaylistCard：
 * 130dp 封面 + 12dp 圆角 + 播放量角标（右下黑底白字）+ 歌名 13sp Medium + 副行 11sp
 */
export default function PlaylistCard(props: IPlaylistCardProps) {
    const {
        title,
        artwork,
        playCount,
        subtitle,
        onPress,
        onLongPress,
        placeholderIcon,
    } = props;
    const colors = useColors();

    const showCount = !!playCount && playCount > 0;

    return (
        <Pressable style={styles.wrapper} onPress={onPress} onLongPress={onLongPress}>
            <View style={styles.coverBox}>
                {artwork ? (
                    <Image
                        style={styles.cover}
                        uri={artwork}
                        emptySrc={ImgAsset.albumDefault}
                    />
                ) : placeholderIcon ? (
                    <LinearGradient
                        colors={[
                            colors.primary,
                            Color(colors.primary).alpha(0.72).toString(),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cover}>
                        <Icon
                            name={placeholderIcon}
                            size={36}
                            color="rgba(255,255,255,0.85)"
                        />
                    </LinearGradient>
                ) : (
                    <View
                        style={[
                            styles.cover,
                            {
                                backgroundColor:
                                    colors.surfaceVariant ??
                                    colors.card,
                            },
                        ]}
                    />
                )}
                {showCount ? (
                    <View style={styles.countBadge}>
                        <ThemeText fontSize="tag" style={styles.countText}>
                            {formatPlayCount(playCount!)}
                        </ThemeText>
                    </View>
                ) : null}
            </View>
            <ThemeText
                fontSize="normal"
                fontWeight="medium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.title}>
                {title}
            </ThemeText>
            {subtitle ? (
                <ThemeText
                    fontSize="caption"
                    fontColor="textSecondary"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.subtitle}>
                    {subtitle}
                </ThemeText>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: 130,
        flexGrow: 0,
        flexShrink: 0,
    },
    coverBox: {
        position: "relative",
    },
    cover: {
        width: 130,
        height: 130,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 6,
    },
    countBadge: {
        position: "absolute",
        right: 6,
        bottom: 6,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    countText: {
        color: "#FFFFFF",
    },
    title: {
        marginTop: 2,
    },
    subtitle: {
        marginTop: 2,
    },
});
