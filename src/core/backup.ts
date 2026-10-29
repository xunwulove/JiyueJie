/** 备份与恢复 */
/** 歌单、插件 */
import { compare } from "compare-versions";
import CryptoJs from "crypto-js";
import DeviceInfo from "react-native-device-info";
import PluginManager from "./pluginManager";
import MusicSheet from "@/core/musicSheet";
import { ResumeMode } from "@/constants/commonConst.ts";

/**
 * 结果：一份大的json文件
 * {
 *     meta: { appVersion, createdAt, checksum },
 *     musicSheets: [],
 *     plugins: [{ srcUrl, version, enabled }],
 * }
 *
 * - plugins：全部已安装插件（含禁用），enabled 记录备份时的启用状态，恢复后按此还原
 * - meta.checksum：对 { musicSheets, plugins } 负载做 SHA-256，
 *   恢复前校验，防止传输/存储损坏导致半恢复；旧备份无 meta 时跳过校验（兼容）。
 * - preview(raw)：恢复前预览校验（解析 + checksum + 概览），供 UI 确认后执行恢复
 */

interface IBackPlugin {
    srcUrl?: string;
    version?: string;
    /** 备份时是否启用（旧备份无此字段 = 视为启用） */
    enabled?: boolean;
}

interface IBackJson {
    musicSheets?: IMusic.IMusicSheetItem[];
    plugins?: IBackPlugin[];
    meta?: { appVersion?: string; createdAt?: string; checksum?: string };
}

/** 备份负载（checksum 计算与恢复校验共用同一键序） */
function buildPayload(
    musicSheets: IMusic.IMusicSheetItem[],
    plugins: IBackPlugin[],
): { musicSheets: IMusic.IMusicSheetItem[]; plugins: IBackPlugin[] } {
    return { musicSheets, plugins };
}

function backup() {
    const musicSheets = MusicSheet.backupSheets();
    // 全量已安装插件（含禁用）：恢复后按 enabled 还原启用状态
    const plugins = PluginManager.getSortedPlugins();
    const normalizedPlugins: IBackPlugin[] = plugins.map(_ => ({
        srcUrl: _.instance.srcUrl,
        version: _.instance.version,
        enabled: PluginManager.isPluginEnabled(_),
    }));
    const payload = buildPayload(musicSheets, normalizedPlugins);
    const checksum = CryptoJs.SHA256(JSON.stringify(payload)).toString();

    return JSON.stringify({
        meta: {
            appVersion: DeviceInfo.getVersion(),
            createdAt: new Date().toISOString(),
            checksum,
        },
        ...payload,
    });
}

/** 备份内容解析（JSON 解析 + checksum 校验），返回原始对象；无效/损坏抛错 */
function parseBackup(raw: string | Object): IBackJson {
    let obj: IBackJson;
    if (typeof raw === "string") {
        try {
            obj = JSON.parse(raw);
        } catch {
            throw new Error("备份文件格式无效");
        }
    } else {
        obj = raw as IBackJson;
    }
    const plugins = Array.isArray(obj?.plugins) ? obj.plugins : [];
    const musicSheets = Array.isArray(obj?.musicSheets) ? obj.musicSheets : [];
    const checksum = obj?.meta?.checksum;
    if (checksum) {
        const actual = CryptoJs.SHA256(
            JSON.stringify(buildPayload(musicSheets, plugins)),
        ).toString();
        if (actual !== checksum) {
            throw new Error("备份文件已损坏（checksum 校验失败），拒绝恢复");
        }
    }
    return obj;
}

/** 恢复前预览（供 UI 确认弹窗展示）：
 *  失败返回 { valid:false, error }；成功返回概览（生成时间/App版本/歌单数/插件数/启用数/校验状态） */
export interface IBackupPreview {
    valid: boolean;
    error?: string;
    createdAt?: string;
    appVersion?: string;
    /** true=checksum 通过；false=无校验信息（旧备份）；undefined=未校验（旧备份兼容） */
    checksumVerified?: boolean;
    pluginsCount: number;
    enabledCount: number;
    sheetsCount: number;
}

export function preview(raw: string | Object): IBackupPreview {
    try {
        const obj = parseBackup(raw);
        const plugins = Array.isArray(obj?.plugins) ? obj.plugins : [];
        const sheets = Array.isArray(obj?.musicSheets) ? obj.musicSheets : [];
        return {
            valid: true,
            createdAt: obj?.meta?.createdAt,
            appVersion: obj?.meta?.appVersion,
            checksumVerified: obj?.meta?.checksum ? true : false,
            pluginsCount: plugins.length,
            enabledCount: plugins.filter(p => p?.enabled !== false).length,
            sheetsCount: sheets.length,
        };
    } catch (e: any) {
        return {
            valid: false,
            error: e?.message ?? "备份文件无效",
            pluginsCount: 0,
            enabledCount: 0,
            sheetsCount: 0,
        };
    }
}

async function resume(
    raw: string | Object,
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    const obj = parseBackup(raw);

    const { plugins, musicSheets } = obj ?? {};
    /** 恢复插件：全量已安装（含禁用）为基准判断同源已装 */
    const validPlugins = PluginManager.getSortedPlugins();
    const resumeTasks: Promise<unknown>[] = [];
    const backupPlugins: IBackPlugin[] = Array.isArray(plugins) ? plugins : [];

    for (const item of backupPlugins) {
        // 校验是否安装过: 同源且本地版本 >= 备份 → 跳过安装，仅按备份还原启用状态
        const local = validPlugins.find(
            plugin => plugin.instance.srcUrl === item.srcUrl,
        );
        if (
            local &&
            compare(
                local.instance.version ?? "0.0.0",
                item.version ?? "0.0.1",
                ">=",
            )
        ) {
            if (item.enabled === false && PluginManager.isPluginEnabled(local)) {
                PluginManager.setPluginEnabled(local, false);
            }
            continue;
        }
        // 需要安装（新装或备份版本更新）；安装成功后按备份 enabled 还原
        const backupEnabled = item.enabled !== false;
        resumeTasks.push(
            PluginManager.installPluginFromUrl(item.srcUrl ?? "", {
                sourceTag: { type: "manual" },
            })
                .then(result => {
                    if (
                        result?.success &&
                        !backupEnabled &&
                        result.pluginHash
                    ) {
                        const installed = PluginManager.getByHash(
                            result.pluginHash,
                        );
                        if (installed) {
                            PluginManager.setPluginEnabled(installed, false);
                        }
                    }
                })
                .catch(() => undefined), // 单插件安装失败不拖垮整体恢复
        );
    }

    /** 恢复歌单（损坏备份中 musicSheets 非数组时按空处理） */
    const validMusicSheets = Array.isArray(musicSheets) ? musicSheets : [];
    const resumeMusicSheets = MusicSheet.resumeSheets(validMusicSheets, resumeMode);

    return Promise.all([...resumeTasks, resumeMusicSheets]);
}

const Backup = {
    backup,
    resume,
    preview,
};
export default Backup;
