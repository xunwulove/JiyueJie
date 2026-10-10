import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import Icon from "@/components/base/icon";
import useColors from "@/hooks/useColors";
import Mp3Util from "@/native/mp3Util";
import { getLocalPath } from "@/utils/mediaUtils";

/**
 * 本地歌曲内嵌封面（列表行小封面）
 *
 * 链路：仅对带本地路径的歌曲，异步调用原生 Mp3Util.getMediaCoverImg 读取音频内嵌封面
 * （原生返回 file:// URI；无内嵌封面时 resolve null；失败 reject）。
 * - 进程内内存缓存：结果 Map + 进行中 Promise Map，同一路径只触发一次原生读盘，
 *   列表快速滚动/行复用/多列表同时展示同一首歌都不会重复读盘。
 * - 绝不阻塞列表渲染：渲染期不 await，拿到封面后 setState 刷新。
 * - 读取中 / 无内嵌封面 / 读取失败 / 图片加载失败 → 渐变占位块（对齐音乐库歌曲行现有占位）。
 * - 非本地歌曲（无 localPath）→ 返回 null，不占布局，网络歌曲封面链路完全不受影响。
 */

/** localPath -> 封面 file:// URI；null 表示已知无封面 */
const coverResultCache = new Map<string, string | null>();
/** localPath -> 进行中的读取 Promise（去并发重复读盘） */
const coverPromiseCache = new Map<string, Promise<string | null>>();

function fetchLocalCover(localPath: string): Promise<string | null> {
    const cached = coverResultCache.get(localPath);
    if (cached !== undefined) {
        return Promise.resolve(cached);
    }
    let pending = coverPromiseCache.get(localPath);
    if (!pending) {
        pending = Mp3Util.getMediaCoverImg(localPath)
            .then(uri => uri ?? null)
            .catch(() => null)
            .then(result => {
                coverResultCache.set(localPath, result);
                return result;
            });
        coverPromiseCache.set(localPath, pending);
    }
    return pending;
}

/** 原生 File(path) 需要 raw 绝对路径，剥离 file:// 前缀 */
function normalizeLocalPath(path: string | null): string | undefined {
    if (!path) {
        return undefined;
    }
    return path.startsWith("file://") ? path.slice("file://".length) : path;
}

interface ILocalSongCoverProps {
    musicItem: IMusic.IMusicItem;
    /** 封面边长（dp），默认 48，对齐列表行封面规范 */
    size?: number;
    /** 圆角（dp），默认 8 */
    borderRadius?: number;
    style?: ViewStyle;
}

export default function LocalSongCover(props: ILocalSongCoverProps) {
    const { musicItem, size = 48, borderRadius = 8, style } = props;
    const colors = useColors();

    const localPath = normalizeLocalPath(getLocalPath(musicItem));

    // 同步读缓存：已知结果（URI 或 null）直接作为初始 state，避免占位→封面闪烁
    const [coverUri, setCoverUri] = useState<string | null | undefined>(
        () => (localPath ? coverResultCache.get(localPath) : undefined),
    );
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!localPath) {
            return;
        }
        let cancelled = false;
        fetchLocalCover(localPath).then(uri => {
            if (!cancelled) {
                setCoverUri(uri);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [localPath]);

    useEffect(() => {
        setLoadError(false);
    }, [coverUri]);

    // 非本地歌曲：不渲染任何占位，不占布局（网络歌曲行保持现状）
    if (!localPath) {
        return null;
    }

    const boxStyle: ViewStyle = {
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
    };

    const showImage = coverUri && !loadError;

    if (showImage) {
        return (
            <View style={[boxStyle, style]}>
                <Image
                    style={{ width: size, height: size, borderRadius }}
                    source={{ uri: coverUri as string }}
                    onError={() => setLoadError(true)}
                />
            </View>
        );
    }

    // 占位：主题色渐变 + 音符图标（对齐 libraryTab LocalSongItem 现有封面占位）
    return (
        <LinearGradient
            colors={[
                colors.primary,
                Color(colors.primary).alpha(0.75).toString(),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[boxStyle, styles.placeholder, style]}>
            <Icon
                name="musical-note"
                size={Math.round(size * 0.45)}
                color="#FFFFFF"
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    placeholder: {
        alignItems: "center",
        justifyContent: "center",
    },
});
