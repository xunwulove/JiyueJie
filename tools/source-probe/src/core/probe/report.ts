/**
 * 探测报告生成与导出（v2：五档分类 + 全字段明细 + 失败原因标准化 + 建议动作）
 *
 * 探测完成后，从持久化结果（MMKV）汇总生成一份 Markdown 报告：
 * - 总览统计（五档源状态 + 各能力计数 + 失败原因分布）
 * - 推荐音源（真能播放）表格
 * - 可解析但播放失败（含标准化原因 + 建议动作）——「半死源」单独成节
 * - 半可用 / 歌单型 / 死源 分节
 * - 全部明细（每个音源全字段：5 类搜索逐个、样本、各能力、失败原因、耗时）
 *
 * 导出：写入应用缓存目录 → 系统分享面板（可发给 AI / 存入网盘 / 转发给协作者）。
 * 目标：AI 初筛 + 探测实测 的工作流闭环——报告直接可投喂给 AI 做二次整理。
 */
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import DeviceInfo from "react-native-device-info";
import { Plugin } from "@/core/pluginManager/plugin";
import { IProbeResult, SEARCH_TYPES, SearchType } from "./index";
import { classifyPlayError } from "./playback";

/** 源状态五档（按用户价值从高到低） */
type SourceTier = "全通" | "可解析不可播" | "半可用" | "歌单型" | "死源";

function tierOf(r: IProbeResult | undefined): SourceTier {
    if (!r) {
        return "死源";
    }
    if (r.playableOk) {
        return "全通";
    }
    if (!r.searchOk && r.sheetsOk) {
        return "歌单型";
    }
    if (r.mediaSourceOk && !r.playableOk) {
        return "可解析不可播";
    }
    if (
        r.searchOk ||
        r.lyricOk ||
        r.sheetsOk ||
        r.albumOk ||
        r.artistWorksOk ||
        r.commentsOk
    ) {
        return "半可用";
    }
    return "死源";
}

/** 单个搜索类型的单元格 */
function searchCell(r: IProbeResult | undefined, t: SearchType): string {
    if (!r) {
        return "—";
    }
    return r.searchTypesOk[t] ? "✓" : "✗";
}

/** 播放失败原因 → 建议动作（供人工/插件维护者处置） */
function suggestAction(r: IProbeResult): string {
    const reason = r.playError || r.mediaSourceError || "";
    const m = reason.toLowerCase();
    if (
        m.includes("403") ||
        m.includes("鉴权") ||
        m.includes("防盗链") ||
        m.includes("auth") ||
        m.includes("token") ||
        m.includes("sign")
    ) {
        return "需补 headers/Referer 或更新插件";
    }
    if (m.includes("404") || m.includes("不存在")) {
        return "直链失效，源可能已死";
    }
    if (
        m.includes("网络") ||
        m.includes("timeout") ||
        m.includes("超时") ||
        m.includes("缓冲")
    ) {
        return "接口不稳定或直链时效短，可重试/播放时动态取链";
    }
    if (
        m.includes("格式") ||
        m.includes("unsupported") ||
        m.includes("codec") ||
        m.includes("decode")
    ) {
        return "URL 实际格式与插件声明不符";
    }
    if (m.includes("无播放地址") || m.includes("无样本")) {
        return "探测样本缺失，需人工复核";
    }
    if (m.includes("未实现")) {
        return "插件缺方法，等上游补充";
    }
    return "原因未分类，需人工复核";
}

/** 从插件实例尽量取元信息，缺失时留空 */
function pluginMeta(p: Plugin) {
    const inst = (p as any).instance as
        | { version?: string; author?: string; homePage?: string; description?: string }
        | undefined;
    return {
        version: inst?.version ?? "",
        author: inst?.author ?? "",
        homePage: inst?.homePage ?? "",
        description: inst?.description ?? "",
    };
}

/** 单个音源明细行（结果 → 全字段单元格） */
function fullCells(r: IProbeResult | undefined) {
    if (!r) {
        return {
            tier: "—" as SourceTier,
            search: "—",
            media: "—",
            play: "—",
            sheets: "—",
            lyric: "—",
            lrcTr: "—",
            artist: "—",
            album: "—",
            comments: "—",
            sample: "—",
            reason: "",
        };
    }
    return {
        tier: tierOf(r),
        search: r.searchOk ? "✓" : "✗",
        media: r.mediaSourceOk ? "✓" : "✗",
        play: r.playableOk ? "✓" : "✗",
        sheets: r.sheetsOk ? "✓" : "✗",
        lyric: r.lyricOk ? "✓" : "✗",
        lrcTr: r.lyricTranslationOk ? "✓" : "✗",
        artist: r.artistWorksOk ? "✓" : "✗",
        album: r.albumOk ? "✓" : "✗",
        comments: r.commentsOk ? "✓" : "✗",
        sample: r.sampleTitle ? `${r.sampleTitle}${r.sampleArtist ? " / " + r.sampleArtist : ""}` : "—",
        reason: r.playError || r.mediaSourceError || r.lastError || "",
    };
}

/**
 * 生成探测报告（Markdown 文本）
 * @param plugins 当前已挂载的全部插件（保持探测时的顺序）
 * @param results 探测结果（hash → IProbeResult）
 * @param probeAt 探测完成时间
 */
export function buildProbeReport(
    plugins: Plugin[],
    results: Record<string, IProbeResult>,
    probeAt: Date,
): string {
    const total = plugins.length;
    const withResult = plugins.filter(p => results[p.hash]);
    const counted = withResult.map(p => ({ p, r: results[p.hash] }));

    const n = (fn: (r: IProbeResult) => boolean) =>
        counted.filter(({ r }) => fn(r)).length;

    const playable = n(r => r.playableOk);
    const search = n(r => r.searchOk);
    const media = n(r => r.mediaSourceOk);
    const sheets = n(r => r.sheetsOk);
    const lyric = n(r => r.lyricOk);
    const lrcTr = n(r => r.lyricTranslationOk);
    const artist = n(r => r.artistWorksOk);
    const album = n(r => r.albumOk);
    const comments = n(r => r.commentsOk);
    /** 歌单型源：有歌单但搜索无结果（WebDAV/自建/AI 生成等，非失效） */
    const sheetType = n(r => !r.searchOk && r.sheetsOk);
    /** 可解析但播放失败（半死源，最有修复价值的一档） */
    const parsedOnly = n(r => r.mediaSourceOk && !r.playableOk);

    const tierCount: Record<SourceTier, number> = {
        全通: playable,
        可解析不可播: parsedOnly,
        半可用: 0,
        歌单型: sheetType,
        死源: 0,
    };
    counted.forEach(({ r }) => {
        const t = tierOf(r);
        if (t === "半可用" || t === "死源") {
            tierCount[t] = (tierCount[t] ?? 0) + 1;
        }
    });

    // 失败原因分类统计（标准化：classifyPlayError 归一后聚合；仅统计 playableOk=false）
    const reasonCount: Record<string, number> = {};
    counted
        .filter(({ r }) => !r.playableOk)
        .forEach(({ r }) => {
            const reason = classifyPlayError(r.playError || r.mediaSourceError);
            reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
        });
    const reasonSummary = Object.entries(reasonCount)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}个`);

    const lines: string[] = [];
    lines.push("# 音源探测报告");
    lines.push("");
    lines.push(`- 生成时间：${probeAt.toLocaleString("zh-CN", { hour12: false })}`);
    lines.push(`- 探测音源：${total} 个（已出结果 ${withResult.length} 个）`);
    lines.push("");
    lines.push("## 一、总览");
    lines.push("");
    lines.push("| 指标 | 数量 |");
    lines.push("| --- | --- |");
    lines.push(`| 🟢 全通（真能播放） | ${tierCount["全通"]} |`);
    lines.push(`| 🟠 可解析不可播（半死源，可修复） | ${tierCount["可解析不可播"]} |`);
    lines.push(`| 🟡 半可用（部分能力可用） | ${tierCount["半可用"]} |`);
    lines.push(`| 🟣 歌单型源（搜索无结果，非失效） | ${tierCount["歌单型"]} |`);
    lines.push(`| 🔴 死源（全能力失败） | ${tierCount["死源"]} |`);
    lines.push("| --- | --- |");
    lines.push(`| 可搜索 | ${search} |`);
    lines.push(`| 可解析播放地址 | ${media} |`);
    lines.push(`| 有歌单 | ${sheets} |`);
    lines.push(`| 有歌词 | ${lyric}（含翻译 ${lrcTr}） |`);
    lines.push(`| 有歌手作品 | ${artist} |`);
    lines.push(`| 有专辑 | ${album} |`);
    lines.push(`| 有评论 | ${comments} |`);
    lines.push("");
    lines.push(`播放失败原因分布：${reasonSummary.length > 0 ? reasonSummary.join("，") : "无"}`);
    lines.push("");
    lines.push("> 档位判定优先级：全通 > 可解析不可播 > 半可用 > 歌单型 > 死源。");
    lines.push("> 「可解析不可播」= 能拿到播放地址但真实播放失败——此类最有修复价值，见第三节。");
    lines.push("");

    // 一、推荐音源（真能播放）
    const recommend = counted.filter(({ r }) => r.playableOk);
    lines.push("## 二、推荐音源（真能播放）");
    lines.push("");
    if (recommend.length === 0) {
        lines.push("（无——所有音源均未通过播放验证）");
        lines.push("");
    } else {
        lines.push("| 音源 | 版本 | 搜索 | 解析 | 播放 | 歌单 | 歌词 | 音频时长(s) | 验证耗时(ms) |");
        lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
        recommend.forEach(({ p, r }) => {
            const meta = pluginMeta(p);
            lines.push(
                `| ${p.name} | ${meta.version || "—"} | ${r.searchOk ? "✓" : "✗"} | ` +
                    `${r.mediaSourceOk ? "✓" : "✗"} | ✓ | ${r.sheetsOk ? "✓" : "✗"} | ` +
                    `${r.lyricOk ? "✓" : "✗"} | ${Math.round(r.playDurationSec ?? 0)} | ${r.playVerifyMs ?? "—"} |`,
            );
        });
        lines.push("");
    }

    // 二、可解析但播放失败（半死源）——含建议动作
    const parsedOnlyList = counted.filter(
        ({ r }) => r.mediaSourceOk && !r.playableOk,
    );
    if (parsedOnlyList.length > 0) {
        lines.push("## 三、可解析但播放失败（半死源）");
        lines.push("");
        lines.push(
            "> 能搜索、能解析出播放地址，但真实播放失败。**这类源不是死源**：多数是防盗链/直链时效/接口不稳定导致，修复插件即可复活。按失败原因处置。",
        );
        lines.push("");
        lines.push("| 音源 | 版本 | 失败原因 | 建议动作 | 样本 | 搜索 | 歌单 | 歌词 |");
        lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
        parsedOnlyList.forEach(({ p, r }) => {
            const meta = pluginMeta(p);
            lines.push(
                `| ${p.name} | ${meta.version || "—"} | ${classifyPlayError(r.playError || r.mediaSourceError)} | ` +
                    `${suggestAction(r)} | ${r.sampleTitle ? r.sampleTitle : "—"} | ` +
                    `${r.searchOk ? "✓" : "✗"} | ${r.sheetsOk ? "✓" : "✗"} | ${r.lyricOk ? "✓" : "✗"} |`,
            );
        });
        lines.push("");
    }

    // 三、半可用（有部分能力但不可播、非歌单型）
    const semi = counted.filter(
        ({ r }) =>
            tierOf(r) === "半可用",
    );
    if (semi.length > 0) {
        lines.push("## 四、半可用（部分能力可用，但不可播放）");
        lines.push("");
        lines.push("| 音源 | 版本 | 搜索 | 解析 | 歌单 | 歌词 | 歌手作品 | 专辑 | 评论 | 说明 |");
        lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
        semi.forEach(({ p, r }) => {
            const meta = pluginMeta(p);
            const c = fullCells(r);
            lines.push(
                `| ${p.name} | ${meta.version || "—"} | ${c.search} | ${c.media} | ${c.sheets} | ` +
                    `${c.lyric} | ${c.artist} | ${c.album} | ${c.comments} | ${c.reason || "—"} |`,
            );
        });
        lines.push("");
    }

    // 四、歌单型源
    const sheetOnly = counted.filter(
        ({ r }) => !r.searchOk && r.sheetsOk,
    );
    if (sheetOnly.length > 0) {
        lines.push("## 五、歌单型源（搜索无结果属正常，非失效）");
        lines.push("");
        lines.push("| 音源 | 版本 | 歌单 | 歌单标签 | 解析 | 播放 | 说明 |");
        lines.push("| --- | --- | --- | --- | --- | --- | --- |");
        sheetOnly.forEach(({ p, r }) => {
            const meta = pluginMeta(p);
            lines.push(
                `| ${p.name} | ${meta.version || "—"} | ${r.sheetsOk ? "✓" : "✗"} | ` +
                    `${r.sheetTagsOk ? "✓" : "✗"} | ${r.mediaSourceOk ? "✓" : "✗"} | ` +
                    `${r.playableOk ? "✓" : "✗"} | ${r.sheetsError || ""} |`,
            );
        });
        lines.push("");
    }

    // 五、死源（全能力失败）
    const dead = counted.filter(({ r }) => tierOf(r) === "死源");
    if (dead.length > 0) {
        lines.push("## 六、死源（全能力失败）");
        lines.push("");
        lines.push("| 音源 | 版本 | 搜索 | 解析 | 歌单 | 歌词 | 说明 |");
        lines.push("| --- | --- | --- | --- | --- | --- | --- |");
        dead.forEach(({ p, r }) => {
            const meta = pluginMeta(p);
            lines.push(
                `| ${p.name} | ${meta.version || "—"} | ${r.searchOk ? "✓" : "✗"} | ` +
                    `${r.mediaSourceOk ? "✓" : "✗"} | ${r.sheetsOk ? "✓" : "✗"} | ` +
                    `${r.lyricOk ? "✓" : "✗"} | ${r.lastError || r.searchError || ""} |`,
            );
        });
        lines.push("");
    }

    // 六、全部明细（全字段，每个音源的全部信息）
    lines.push("## 七、全部明细");
    lines.push("");
    lines.push(
        "| 音源 | 版本 | 档位 | 搜-单曲 | 搜-专辑 | 搜-歌手 | 搜-歌单 | 搜-歌词 | 解析 | 播放 | 歌单 | 歌词 | 翻译 | 歌手作品 | 专辑 | 评论 | 样本 | 失败原因 | 耗时(ms) |",
    );
    lines.push(
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    plugins.forEach(p => {
        const r = results[p.hash];
        const c = fullCells(r);
        const meta = pluginMeta(p);
        const searchRow = SEARCH_TYPES.map(t => searchCell(r, t)).join(" | ");
        lines.push(
            `| ${p.name} | ${meta.version || "—"} | ${c.tier} | ${searchRow} | ` +
                `${c.media} | ${c.play} | ${c.sheets} | ${c.lyric} | ${c.lrcTr} | ${c.artist} | ` +
                `${c.album} | ${c.comments} | ${c.sample} | ${c.reason || "—"} | ${r ? r.durationMs : "—"} |`,
        );
    });
    lines.push("");

    lines.push("---");
    lines.push(
        `> 说明：播放=深度播放验证（真实播放样本歌曲 ≥2s 无报错，**静音验证**）。本报告由音源探测 v${DeviceInfo.getVersion()} 生成，供人工复核与 AI 二次整理。`,
    );
    lines.push("");
    return lines.join("\n");
}

/**
 * 导出探测报告：写入缓存目录（file:// URI）→ 调起系统分享面板。
 * 与插件导出（pluginList.tsx）同一套已验证路径：expo-file-system cacheDirectory + Sharing。
 * 失败向上抛出（由 UI 层 Toast 提示），不再静默吞错。
 */
export async function exportProbeReport(md: string): Promise<void> {
    const fileName = `probe-report-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, "")}.md`;
    const fileUri = `${FileSystem.cacheDirectory ?? ""}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, md);
    if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
            mimeType: "text/plain",
            dialogTitle: "分享音源探测报告",
        });
    }
}
