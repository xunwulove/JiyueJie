/**
 * 音源主动探测服务（极悦界内嵌"轻量体检"）
 *
 * 与探测软件（独立 APK，全量深度验证）分工：极悦界内嵌探测做日常维护，
 * 串行探测已启用可搜索音源，结果写入分维度统计（search/parse/play）。
 * 深度模式（手动"检测音源"）额外做**真实播放验证**：原生独立 ExoPlayer
 * 静默播放样本 ≥2s（方案 B）——音量 0、不抢音频焦点、不打断当前播放，
 * 判定口径与用户真实播放一致，结果直接写入 play 维度。
 *
 * 触发：
 * - 自动（启动后延迟 20s，bootstrap 调度）：每天最多一轮，
 *   只探测"上次探测 >24h"的源，轻量（搜索+解析，不播放）
 * - 手动（音源管理页"检测音源"按钮）：随时全量深度探测（含真播放验证）
 *
 * 约束（防风控/防卡顿）：
 * - 串行执行，源间间隔 1.5s
 * - 总预算 60s，超时放弃剩余源
 * - 只探测已启用且可搜索的源；失败不重试（留给下一轮）
 */
import PluginManager from "@/core/pluginManager";
import pluginReliability from "@/core/pluginReliability";
import ProbePlayer from "@/native/probePlayer";
import Config from "@/core/appConfig";
import { getQualityOrder } from "@/utils/qualities";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { devLog } from "@/utils/log";

/** 探测状态持久化（MMKV） */
const probeStore = getOrCreateMMKV("ProbeState");

/** 源间间隔（防风控） */
const PROBE_INTERVAL_MS = 1500;
/** 单轮总预算 */
const PROBE_BUDGET_MS = 60 * 1000;
/** 数据过期判定：上次探测超过该时长视为过期 */
const PROBE_STALE_MS = 24 * 60 * 60 * 1000;
/** 探测样本关键词（中文歌在各源命中率高） */
const PROBE_KEYWORD = "海阔天空";

/**
 * 运行互斥：自动（probeAuto）与手动（probeAllPlugins）共用同一执行体，
 * 防"后台探测未结束又触发新轮"造成并发（同源重复请求、统计写入乱序、风控风险）。
 * 互斥粒度为一整轮：任一模式在跑时，另一模式直接放弃本轮（不排队、不合并）。
 */
let probing = false;
/** 当前是否有探测轮次在运行（供 UI 入口先行提示，避免弹窗闪现） */
export function isProbing(): boolean {
    return probing;
}

/** 单源探测结果 */
export interface IProbeItem {
    platform: string;
    name: string;
    searchOk: boolean;
    parseOk: boolean;
    /** 深度模式：解析出的音频地址能拉到真实音频数据 */
    playable: boolean;
    error?: string;
}

/** 一轮探测报告 */
export interface IProbeReport {
    results: IProbeItem[];
    total: number;
    searchOk: number;
    parseOk: number;
    playable: number;
    usedMs: number;
}

/* ============ 持久化：每源上次探测时间 / 每日自动轮次 ============ */

function readLastRuns(): Record<string, number> {
    const raw = probeStore.getString("lastRuns");
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(raw) as Record<string, number>;
    } catch {
        return {};
    }
}

function writeLastRuns(map: Record<string, number>): void {
    probeStore.set("lastRuns", JSON.stringify(map));
}

function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readAutoDate(): string | null {
    return probeStore.getString("autoDate") ?? null;
}

function writeAutoDate(date: string): void {
    probeStore.set("autoDate", date);
}

/* ============ 探测执行 ============ */

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 音频数据可拉取验证（深度模式的可播性判定）：
 * 对解析出的播放地址做 Range 请求拉取前 2KB，返回"非文本类内容"即视为可播。
 * 不依赖播放器、静默、不打断当前播放；对假页面（text/html）可有效排除。
 */
async function verifyAudioFetchable(
    url: string,
    headers?: Record<string, string>,
): Promise<boolean> {
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                ...(headers ?? {}),
                Range: "bytes=0-2048",
            },
        });
        if (!res.ok && res.status !== 206) {
            return false;
        }
        const contentType = res.headers?.get?.("content-type") ?? "";
        const isTextPage =
            contentType.includes("text/html") ||
            contentType.includes("text/plain") ||
            contentType.includes("application/json");
        if (isTextPage) {
            return false;
        }
        const buf = await res.arrayBuffer();
        return buf.byteLength > 0;
    } catch {
        return false;
    }
}

/**
 * 深度可播验证：优先原生独立 ExoPlayer 静默播放验证（方案 B，真解码真播放 ≥2s 无错，
 * 与用户真实播放判定口径一致），原生模块不可用时降级为 Range 数据拉取验证。
 */
async function probePlayable(
    url: string,
    headers?: Record<string, string>,
): Promise<boolean> {
    try {
        if (ProbePlayer?.probeUrl) {
            const ok = await ProbePlayer.probeUrl(
                url,
                headers ?? null,
                15000,
            );
            if (ok === true) {
                return true;
            }
            // 原生验证明确失败（错误/超时）→ 直接判不可播，不再降级兜底
            return false;
        }
    } catch {
        // 原生调用异常（模块缺失/异常）→ 降级网络层拉取验证
    }
    return verifyAudioFetchable(url, headers);
}

/** 单源探测：搜索 → 解析 → （深度）真播放验证 */
async function probeSingle(
    plugin: any,
    deep: boolean,
): Promise<IProbeItem> {
    const platform = plugin.instance.platform;
    const out: IProbeItem = {
        platform,
        name: plugin.name,
        searchOk: false,
        parseOk: false,
        playable: false,
    };
    try {
        const result = await plugin.methods?.search?.(
            PROBE_KEYWORD,
            1,
            "music",
        );
        const data = result?.data ?? [];
        out.searchOk = data.length > 0;
        void pluginReliability.recordResult(
            platform,
            out.searchOk,
            "search",
        );
        if (data.length && plugin.methods?.getMediaSource) {
            const qualityOrder = getQualityOrder(
                Config.getConfig("basic.defaultPlayQuality") ?? "standard",
                Config.getConfig("basic.playQualityOrder") ?? "asc",
            );
            let url: string | null = null;
            let headers: Record<string, string> | undefined;
            for (const quality of qualityOrder) {
                try {
                    const source =
                        (await plugin.methods.getMediaSource(
                            data[0],
                            quality,
                        )) ?? null;
                    if (source?.url) {
                        url = source.url;
                        headers = source.headers;
                        break;
                    }
                } catch {
                    // 该质量解析失败，尝试下一档
                }
            }
            out.parseOk = !!url;
            void pluginReliability.recordResult(
                platform,
                out.parseOk,
                "parse",
            );
            if (deep && url) {
                out.playable = await probePlayable(url, headers);
                // 深度探测是真播放验证（独立 ExoPlayer ≥2s），与用户真实播放判定口径一致，
                // 直接写入 play 维度（探测成功/失败均记录）
                void pluginReliability.recordPlayResult(
                    platform,
                    out.playable,
                );
            }
        }
    } catch (e: any) {
        out.error = e?.message ?? "探测异常";
        void pluginReliability.recordResult(
            platform,
            false,
            "search",
        );
    }
    return out;
}

/** 探测一组插件（串行 + 间隔 + 总预算）；整轮持有互斥锁，finally 必复位 */
async function probePlugins(
    plugins: any[],
    deep: boolean,
    onProgress?: (done: number, total: number, name: string) => void,
): Promise<IProbeReport> {
    probing = true;
    try {
        const startTime = Date.now();
        const lastRuns = readLastRuns();
        const results: IProbeItem[] = [];
        let searchOk = 0;
        let parseOk = 0;
        let playable = 0;

        for (let i = 0; i < plugins.length; i++) {
            if (Date.now() - startTime > PROBE_BUDGET_MS) {
                devLog("info", "音源探测：总预算耗尽，剩余源跳过", plugins.length - i);
                break;
            }
            const plugin = plugins[i];
            const platform = plugin.instance.platform;
            try {
                const item = await probeSingle(plugin, deep);
                results.push(item);
                if (item.searchOk) {
                    searchOk += 1;
                }
                if (item.parseOk) {
                    parseOk += 1;
                }
                if (item.playable) {
                    playable += 1;
                }
                lastRuns[platform] = Date.now();
            } catch (e: any) {
                devLog("error", "音源探测异常", platform, e?.message ?? e);
            }
            onProgress?.(results.length, plugins.length, plugin.name);
            if (i < plugins.length - 1) {
                await sleep(PROBE_INTERVAL_MS);
            }
        }
        writeLastRuns(lastRuns);
        return {
            results,
            total: plugins.length,
            searchOk,
            parseOk,
            playable,
            usedMs: Date.now() - startTime,
        };
    } finally {
        probing = false;
    }
}

/** 手动全量探测（音源管理页"检测音源"按钮）：随时可跑，深度验证可播性；
 *  返回 null 表示已有其他轮次在跑（本次未执行） */
export async function probeAllPlugins(options?: {
    deep?: boolean;
    onProgress?: (done: number, total: number, name: string) => void;
}): Promise<IProbeReport | null> {
    if (probing) {
        return null;
    }
    const plugins = PluginManager.getSortedSearchablePlugins("music");
    return probePlugins(plugins, options?.deep ?? true, options?.onProgress);
}

/** 自动探测（启动后延迟调度）：每天最多一轮，只探测数据过期（>24h）的源，轻量；
 *  若已有轮次在跑（含手动检测）则本轮放弃 */
export async function probeAuto(): Promise<IProbeReport | null> {
    if (probing) {
        return null;
    }
    try {
        const today = todayStr();
        if (readAutoDate() === today) {
            return null; // 今天已跑过
        }
        writeAutoDate(today);
        const now = Date.now();
        const lastRuns = readLastRuns();
        const stalePlugins = PluginManager.getSortedSearchablePlugins(
            "music",
        ).filter(p => {
            const last = lastRuns[p.instance.platform];
            return !last || now - last > PROBE_STALE_MS;
        });
        if (!stalePlugins.length) {
            return null; // 无过期源，无需探测
        }
        return await probePlugins(stalePlugins, false);
    } catch (e: any) {
        devLog("error", "自动探测失败", e?.message ?? e);
        return null;
    }
}

const probeService = {
    probeAllPlugins,
    probeAuto,
    isProbing,
};

export default probeService;
