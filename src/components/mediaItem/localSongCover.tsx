import React, { useEffect, useState } from "react";
import { Image, View, ViewStyle } from "react-native";
import Mp3Util from "@/native/mp3Util";
import { ImgAsset } from "@/constants/assetsConst";
import { getLocalPath } from "@/utils/mediaUtils";

/**
 * 歌曲行封面（列表行小封面，48dp 圆角 8）
 *
 * 两类来源：
 * 1. 本地歌曲（带 localPath）：异步调用原生 Mp3Util.getMediaCoverImg 读取音频内嵌封面
 *    （原生返回 file:// URI；无内嵌封面时 resolve null；失败 reject）。
 *    - 进程内内存缓存：结果 Map + 进行中 Promise Map，同一路径只触发一次原生读盘。
 *    - 绝不阻塞列表渲染：渲染期不 await，拿到封面后 setState 刷新。
 * 2. 网络歌曲（无 localPath）：直接渲染 musicItem.artwork 网络图；
 *    无 artwork 或加载失败 → 渐变占位块。
 * - 任何来源的读取中 / 无封面 / 加载失败 → 渐变占位块（统一行布局，不跳位）。
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
            .then(uri => {
                // 成功（含"确认无内嵌封面"resolve null）才缓存；
                // 读取失败不缓存、并移除进行中标记，允许后续挂载/播放后重试成功
                const result = uri ?? null;
                coverResultCache.set(localPath, result);
                return result;
            })
            .catch(() => {
                coverPromiseCache.delete(localPath);
                return null;
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

    const localPath = normalizeLocalPath(getLocalPath(musicItem));
    // artwork（网络 URL 或下载保存的本地封面）作为内嵌封面缺失时的回退：
    // 部分下载歌曲音频未写入内嵌封面，播放页用 artwork 显示正常，列表也应一致
    const artwork = musicItem.artwork;

    // 同步读缓存：已知结果（URI 或 null）直接作为初始 state，避免占位→封面闪烁；
    // 无本地路径（纯网络歌曲）视为"无内嵌封面可读"，直接走 artwork
    const [coverUri, setCoverUri] = useState<string | null | undefined>(
        () => (localPath ? coverResultCache.get(localPath) : null),
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
    }, [coverUri, artwork]);

    const boxStyle: ViewStyle = {
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
    };

    // 封面展示优先级：内嵌封面（读取完成）> artwork 回退（确认无内嵌封面或纯网络歌曲）> 占位
    // coverUri === undefined 表示内嵌封面仍在读取中，先显示占位避免闪烁；
    // coverUri === null 表示"确认无内嵌封面"，此时回退 musicItem.artwork（网络歌/本地歌通用）
    const showImage =
        coverUri !== undefined &&
        (coverUri || artwork) &&
        !loadError;

    if (showImage) {
        return (
            <View style={[boxStyle, style]}>
                <Image
                    style={{ width: size, height: size, borderRadius }}
                    source={{ uri: (coverUri ?? artwork) as string }}
                    onError={() => setLoadError(true)}
                />
            </View>
        );
    }

    // 占位：显示默认封面图（与真实封面同样 cover 铺满展示，统一默认封面观感）
    return (
        <View style={[boxStyle, style]}>
            <Image
                style={{ width: size, height: size, borderRadius }}
                source={ImgAsset.albumDefault}
                resizeMode="cover"
            />
        </View>
    );
}
