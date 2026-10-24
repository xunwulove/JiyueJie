/**
 * 时长单位防御性归一化（毫秒 → 秒）
 *
 * MusicFree 插件协议规定 IMusicItem.duration 单位为「秒」，
 * 但第三方音源（插件）存在返回毫秒的情况，导致「听歌时长」统计虚大
 * （一首 4.5 分钟的歌若以毫秒 273600 入库，会被当成 273600 秒 = 76 小时）。
 *
 * 规则：仅当数值明显超过单曲合理上限（> 2 小时 = 7200s），
 * 且除以 1000 后落在正常歌曲时长区间（30s ~ 2h）时，判定为毫秒并转换；
 * 长音频/播客（秒单位，如 2.5h = 9000s）除以 1000 后 < 30s，不会被误伤。
 */
export function normalizeDurationSec(d: number | null | undefined): number {
    if (!d || d <= 0 || Number.isNaN(d)) {
        return 0;
    }
    if (d > 7200) {
        const asSeconds = d / 1000;
        if (asSeconds >= 30 && asSeconds <= 7200) {
            return Math.round(asSeconds);
        }
    }
    return d;
}
