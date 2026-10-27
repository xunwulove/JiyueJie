/**
 * 音质相关的所有工具代码
 */

export const qualityKeys: IMusic.IQualityKey[] = [
    "low",
    "standard",
    "high",
    "super",
];

export const qualityText = {
    low: "低音质",
    standard: "标准音质",
    high: "高音质",
    super: "超高音质",
};

/** 获取音质顺序 */
export function getQualityOrder(
    qualityKey: IMusic.IQualityKey,
    sort: "asc" | "desc",
) {
    const idx = qualityKeys.indexOf(qualityKey);
    if (idx < 0) {
        // 未知音质：退化为默认顺序，避免 left/right 切片产生重复音质
        return qualityKeys.slice();
    }
    const left = qualityKeys.slice(0, idx);
    const right = qualityKeys.slice(idx + 1);
    if (sort === "asc") {
        /** 优先高音质 */
        return [qualityKey, ...right, ...left.reverse()];
    } else {
        /** 优先低音质 */
        return [qualityKey, ...left.reverse(), ...right];
    }
}

/**
 * 下一个音质（QQ 音乐式循环切换）：low→standard→high→super→low…
 * 未知/末位音质回绕到首位，用于音质标识点击自动切换
 */
export function getNextQuality(
    current: IMusic.IQualityKey | undefined,
): IMusic.IQualityKey {
    const idx = current ? qualityKeys.indexOf(current) : -1;
    if (idx < 0 || idx === qualityKeys.length - 1) {
        return qualityKeys[0];
    }
    return qualityKeys[idx + 1];
}
