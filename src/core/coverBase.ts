import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { atom, getDefaultStore, useAtomValue } from "jotai";

/**
 * 自制封面底图配置（方案一：仅界面展示）：
 * 用户本地选一张图作为底图，无封面歌曲展示"底图 + 歌名"合成封面。
 * 存 MMKV `music.CoverBase`；除底图路径外，记录图片固有宽高（选图时 Image.getSize
 * 取得）与取图位置 offset（0~1，沿图片长边方向的截取位置：竖图沿高、横图沿宽，
 * 正方形图无偏移）。合成封面按短边取最大内接正方形，cover 铺满后沿长边平移 offset。
 */
export interface ICoverBase {
    path: string | null;
    /** 取图位置 0~1（沿长边方向：0=起点/顶或左，1=终点/底或右）；由 imgW/imgH 运行时判主轴 */
    offset: number;
    imgW: number;
    imgH: number;
}

const DEF: ICoverBase = {
    path: null,
    offset: 0.5,
    imgW: 0,
    imgH: 0,
};

const coverBaseStore = getOrCreateMMKV("music.CoverBase");
const coverBaseAtom = atom<ICoverBase>(DEF);

function num(v: string | undefined, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

export function setupCoverBase() {
    const p = coverBaseStore.getString("path");
    const next: ICoverBase = {
        path: p && p.length > 0 ? p : null,
        offset: Math.min(1, Math.max(0, num(coverBaseStore.getString("offset"), 0.5))),
        imgW: num(coverBaseStore.getString("imgW"), 0),
        imgH: num(coverBaseStore.getString("imgH"), 0),
    };
    if (!next.path) {
        next.offset = 0.5;
        next.imgW = 0;
        next.imgH = 0;
    }
    getDefaultStore().set(coverBaseAtom, next);
}

/** 当前底图配置（未设置为 path=null） */
export function useCoverBase() {
    return useAtomValue(coverBaseAtom);
}

/**
 * 设置/清除底图。
 * @param path 底图 uri（null = 清除，重置 offset 与尺寸）
 * @param size 图片固有宽高（选图时 Image.getSize 取得）
 * @param offset 取图位置 0~1（沿长边方向，可选）
 */
export function setCoverBase(
    path: string | null,
    size?: { w: number; h: number },
    offset?: number,
) {
    const cur = getDefaultStore().get(coverBaseAtom);
    let next: ICoverBase;
    if (!path) {
        next = { ...DEF };
    } else {
        next = {
            path,
            imgW: size?.w ?? cur.imgW,
            imgH: size?.h ?? cur.imgH,
            offset:
                offset !== undefined
                    ? Math.min(1, Math.max(0, offset))
                    : cur.offset,
        };
    }
    coverBaseStore.set("path", next.path ?? "");
    coverBaseStore.set("offset", String(next.offset));
    coverBaseStore.set("imgW", String(next.imgW));
    coverBaseStore.set("imgH", String(next.imgH));
    getDefaultStore().set(coverBaseAtom, next);
}
