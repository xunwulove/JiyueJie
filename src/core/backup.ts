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
 *     plugins: [],
 * }
 *
 * meta.checksum：对 { musicSheets, plugins } 负载做 SHA-256，
 * 恢复前校验，防止传输/存储损坏导致半恢复；旧备份无 meta 时跳过校验（兼容）。
 */

interface IBackJson {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: Array<{ srcUrl: string; version: string }>;
}

/** 备份负载（checksum 计算与恢复校验共用同一键序；srcUrl/version 可为 undefined，按实际值参与校验） */
function buildPayload(
    musicSheets: IMusic.IMusicSheetItem[],
    plugins: Array<{ srcUrl?: string; version?: string }>,
): { musicSheets: IMusic.IMusicSheetItem[]; plugins: Array<{ srcUrl?: string; version?: string }> } {
    return { musicSheets, plugins };
}

function backup() {
    const musicSheets = MusicSheet.backupSheets();
    const plugins = PluginManager.getEnabledPlugins();
    const normalizedPlugins = plugins.map(_ => ({
        srcUrl: _.instance.srcUrl,
        version: _.instance.version,
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

async function resume(
    raw: string | Object,
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    let obj: IBackJson & { meta?: { checksum?: string } };
    if (typeof raw === "string") {
        try {
            obj = JSON.parse(raw);
        } catch {
            throw new Error("备份文件格式无效");
        }
    } else {
        obj = raw as IBackJson & { meta?: { checksum?: string } };
    }

    // 恢复前校验 checksum（新备份）：负载不一致 = 文件损坏/被篡改，拒绝恢复
    const checksum = obj?.meta?.checksum;
    if (checksum) {
        const payload = buildPayload(
            Array.isArray(obj?.musicSheets) ? obj.musicSheets : [],
            Array.isArray(obj?.plugins) ? obj.plugins : [],
        );
        const actual = CryptoJs.SHA256(JSON.stringify(payload)).toString();
        if (actual !== checksum) {
            throw new Error("备份文件已损坏（checksum 校验失败），拒绝恢复");
        }
    }

    const { plugins, musicSheets } = obj ?? {};
    /** 恢复插件 */
    const validPlugins = PluginManager.getEnabledPlugins();
    const resumePlugins = Array.isArray(plugins)
        ? plugins?.map(_ => {
            // 校验是否安装过: 同源且本地版本更高就忽略掉
            if (
                validPlugins.find(
                    plugin =>
                        plugin.instance.srcUrl === _.srcUrl &&
                        compare(
                            plugin.instance.version ?? "0.0.0",
                            _.version ?? "0.0.1",
                            ">=",
                        ),
                )
            ) {
                return;
            }
            return PluginManager.installPluginFromUrl(_.srcUrl, {
                sourceTag: { type: "manual" },
            });
        })
        : [];

    /** 恢复歌单（损坏备份中 musicSheets 非数组时按空处理） */
    const validMusicSheets = Array.isArray(musicSheets) ? musicSheets : [];
    const resumeMusicSheets = MusicSheet.resumeSheets(validMusicSheets, resumeMode);

    return Promise.all([...(resumePlugins ?? []), resumeMusicSheets]);
}

const Backup = {
    backup,
    resume,
};
export default Backup;
