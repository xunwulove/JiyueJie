import { useEffect, useState } from "react";
import { useCurrentMusic } from "@/core/trackPlayer";
import ImageColors from "react-native-image-colors";

/**
 * 播放封面氛围取色（方案B）：
 * 取当前播放歌曲封面主色（Android dominant/average），供全局背景叠加极浅氛围色。
 * - 无封面/取色失败 → null（背景回退方案A渐变）
 * - 同封面 URL 缓存结果，切歌才重新取色（低频，不影响性能）
 */
const cacheKeyRef = { key: "", color: null as string | null };

export default function useAlbumTintColor(): string | null {
    const music = useCurrentMusic();
    const artwork = music?.artwork;
    const [tint, setTint] = useState<string | null>(null);

    useEffect(() => {
        if (!artwork) {
            setTint(null);
            return;
        }
        // 同封面直接命中缓存，避免重复取色
        if (cacheKeyRef.key === artwork && cacheKeyRef.color !== undefined) {
            setTint(cacheKeyRef.color);
            return;
        }
        let cancelled = false;
        ImageColors.getColors(artwork, {
            fallback: "#2F6FED",
            cache: true,
            key: `tint-${artwork}`,
        })
            .then(result => {
                if (cancelled) {
                    return;
                }
                const r = result as any;
                const c =
                    r?.dominant ??
                    r?.average ??
                    r?.vibrant ??
                    r?.primary ??
                    null;
                cacheKeyRef.key = artwork;
                cacheKeyRef.color = c;
                setTint(c);
            })
            .catch(() => {
                if (!cancelled) {
                    setTint(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [artwork]);

    return tint;
}
