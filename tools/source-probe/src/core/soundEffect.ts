import { DeviceEventEmitter, NativeModules, Platform } from "react-native";
import RNFS, { exists, mkdir, copyFile, unlink } from "react-native-fs";
import Config from "@/core/appConfig";
import pathConst from "@/constants/pathConst";
import { getFileName } from "@/utils/fileUtils";
import { errorLog, trace } from "@/utils/log";
import Toast from "@/utils/toast";
import i18n from "@/core/i18n";
import { setEqualizer as jdspSetEqualizer, setPostGain, setBassBoost, setStereoEnhancement, setReverb, setVacuumTube, setCrossfeed, setConvolver, loadBuiltinIR, loadIR, IR_PRESETS, DDC_HEADPHONES, REVERB_PRESETS } from "@/core/jamesdsp";

/** 将旧版 N 段毫分贝(millibel)转换为 JamesDSP 15段 dB，线性插值 */
function toJamesDspGains(bands: number[]): number[] {
    const result = new Array(15).fill(0);
    if (!bands || bands.length === 0) return result;
    for (let i = 0; i < 15; i++) {
        const pos = (i / 14) * (bands.length - 1);
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const v0 = (bands[idx] ?? 0) / 100;
        const v1 = (bands[Math.min(idx + 1, bands.length - 1)] ?? 0) / 100;
        result[i] = v0 + (v1 - v0) * frac;
    }
    return result;
}

/**
 * 音效服务（均衡器/低音增强/环绕声）——2026-10-14 新增。
 *
 * 原理：原生 SoundEffectModule 反射读取 RNTP ExoPlayer 的 audioSessionId，
 * 用 android.media.audiofx 的 Equalizer/BassBoost/Virtualizer 绑定该 session。
 * session 在播放器生命周期内固定，attach 一次即生效（模块内幂等）。
 * 每次真实播放（PlaybackActiveTrackChanged）调用 ensureAttached 兜底，失败静默（播放器未就绪）。
 */
const SoundEffect: any = NativeModules.SoundEffectModule;

let attached = false;
let infoCache: {
    bands: number;
    centerFreqs: number[];
    presets: string[];
    levelMin: number;
    levelMax: number;
    bassSupported: boolean;
    virtualizerSupported: boolean;
    loudnessSupported: boolean;
    presetReverbSupported: boolean;
    envReverbSupported: boolean;
    dynamicsSupported: boolean;
} | null = null;
let lastError: string | null = null;

// 音频路由变化（插拔耳机/切换蓝牙）：原生已重建效果器（频段数等能力随路由变化，
// 如扬声器 5 段 / 耳机 10 段）→ 清能力缓存（下次查询重拉）+ 重放当前配置到新效果器
if (Platform.OS === "android" && SoundEffect) {
    DeviceEventEmitter.addListener("SoundEffectReattached", () => {
        infoCache = null;
        trace("音效：音频路由变化，效果器已重建，缓存失效");
        applyAllConfig();
    });
}

// 缺陷9：切歌换采样率 → 原生 DSP 被 nativeInit 重置为 Disable，JS 无感知。
// 原生在采样率/编码/旁路态变化时发射 "JamesDspConfigChanged"，这里重放全部 jdsp 配置。
// 防循环：applyAllConfig 只调用 Bridge setter（setEqualizer/loadIR/setConvolver 等），
// 不会触发 ExoPlayer 的 AudioProcessor.configure()，因此不会再次触发本事件。
if (Platform.OS === "android") {
    DeviceEventEmitter.addListener(
        "JamesDspConfigChanged",
        (payload?: {
            sampleRate: number;
            inputEncoding: string;
            active: boolean;
            bypassed: boolean;
            bypassReason: string | null;
        }) => {
            trace(
                "JamesDspConfigChanged: sr=" +
                    payload?.sampleRate +
                    " enc=" +
                    payload?.inputEncoding +
                    " active=" +
                    payload?.active +
                    " bypassed=" +
                    payload?.bypassed +
                    " reason=" +
                    payload?.bypassReason,
            );
            applyAllConfig();
        },
    );
}

/**
 * 内置 EQ 预设曲线（10 段，单位 millibel，约 ±12dB 内）。
 * 不依赖设备系统预设（Android Equalizer 预设随 ROM 差异大、部分设备为 0）：
 * UI 预设列表固定 = 手动 + 以下 N 个，跨设备统一；
 * 设备频段数少于 10 时取前 N 段近似（频段自低频到高频，截取方向一致）。
 */
export const EQ_PRESETS: { name: string; bands: number[] }[] = [
    { name: "摇滚", bands: [350, 250, -150, -200, 150, 300, 400, 350, 250, 150] },
    { name: "流行", bands: [150, 100, -100, -200, -100, 200, 300, 350, 300, 200] },
    { name: "爵士", bands: [300, 200, -100, -200, -100, 150, 250, 300, 250, 200] },
    { name: "古典", bands: [300, 250, 0, -100, -150, 100, 250, 300, 250, 200] },
    { name: "舞曲", bands: [400, 350, 100, -100, 0, 200, 300, 350, 300, 250] },
    { name: "重低音", bands: [500, 450, 300, 150, 50, -50, -100, -100, 0, 100] },
    { name: "电子", bands: [400, 300, 100, -150, -100, 200, 400, 450, 400, 300] },
    { name: "人声", bands: [150, 100, 150, 250, 300, 200, 100, 0, -100, -150] },
    { name: "高音增强", bands: [-100, 0, 100, 150, 200, 300, 400, 450, 500, 450] },
];

/** 确保效果器已绑定（播放器就绪且有 session 时执行一次） */
export async function ensureSoundEffectAttached() {
    if (attached || Platform.OS !== "android" || !SoundEffect) return;
    try {
        const sessionId = await SoundEffect.getAudioSessionId();
        if (typeof sessionId === "number" && sessionId > 0) {
            SoundEffect.attach(sessionId);
            attached = true;
            lastError = null;
            applyAllConfig();
            trace("均衡器已绑定 session " + sessionId);
        }
    } catch (e: any) {
        // 播放器未就绪（未播放过 → session 未分配）或反射失败：记录原因供页面诊断
        lastError = e?.message ?? e?.code ?? String(e);
        trace("均衡器绑定暂缓: " + lastError);
    }
}

/** 绑定/读取失败时的诊断信息（页面展示用） */
export function getSoundEffectLastError(): string | null {
    return lastError;
}

/** 是否已绑定效果器（播放过歌曲且 attach 成功） */
export function isSoundEffectAttached(): boolean {
    return attached;
}

/** 当前音频输出设备（扬声器/耳机/蓝牙等，供音效页诊断） */
export async function getOutputDevice(): Promise<{
    type: string;
    name: string;
} | null> {
    if (Platform.OS !== "android" || !SoundEffect) return null;
    try {
        const d = await SoundEffect.getOutputDevice();
        return d ?? null;
    } catch {
        return null;
    }
}

/** 效果器能力信息（首次成功缓存；未绑定返回 null） */
export async function getSoundEffectInfo() {
    if (infoCache) return infoCache;
    if (Platform.OS !== "android" || !SoundEffect) return null;
    try {
        const info = await SoundEffect.getInfo();
        if (!info) return null;
        // 设备效果支持情况（查询失败按"支持"保守处理，不阻断 UI）
        let bassSupported = true;
        let virtualizerSupported = true;
        let loudnessSupported = true;
        let presetReverbSupported = true;
        let envReverbSupported = true;
        let dynamicsSupported = true;
        try {
            const ranges = await SoundEffect.getEffectRanges();
            if (ranges) {
                bassSupported = ranges.bassSupported !== false;
                virtualizerSupported = ranges.virtualizerSupported !== false;
                loudnessSupported = ranges.loudnessSupported !== false;
                presetReverbSupported = ranges.presetReverbSupported !== false;
                envReverbSupported = ranges.envReverbSupported !== false;
                dynamicsSupported = ranges.dynamicsSupported !== false;
            }
        } catch {
            // 未 attach 或查询失败：走保守默认
        }
        infoCache = {
            bands: info.bands ?? 0,
            centerFreqs: info.centerFreqs ?? [],
            presets: info.presets ?? [],
            levelMin: info.levelMin ?? -1500,
            levelMax: info.levelMax ?? 1500,
            bassSupported,
            virtualizerSupported,
            loudnessSupported,
            presetReverbSupported,
            envReverbSupported,
            dynamicsSupported,
        };
        return infoCache;
    } catch (e: any) {
        // 不覆盖已有错误：getAudioSessionId 的失败原因（如模块未注册/反射失败）比
        // getInfo 的 "call attach first" 兜底文案更有诊断价值
        if (!lastError) {
            lastError = e?.message ?? e?.code ?? String(e);
        }
        errorLog("读取均衡器能力失败", lastError);
        return null;
    }
}

/** 将当前配置一次性应用到原生（绑定后调用；开关/滑块即改即生效也走各自 setter） */
export function applyAllConfig() {
    if (Platform.OS !== "android") return;
    const enabled = !!Config.getConfig("sound.eqEnabled");
    const preset = Config.getConfig("sound.eqPreset") ?? -1;

    // JamesDSP EQ 恢复（15段 dB）
    if (enabled) {
        if (typeof preset === "number" && preset >= 0) {
            const p = EQ_PRESETS[preset];
            if (p) jdspSetEqualizer(true, toJamesDspGains(p.bands));
        } else {
            const bands15 = Config.getConfig("jdsp.eqBands") ?? new Array(15).fill(0);
            jdspSetEqualizer(true, bands15);
        }
    } else {
        jdspSetEqualizer(false, new Array(15).fill(0));
    }
    // JamesDSP 进阶音效恢复
    const jdspPostGain = Config.getConfig("jdsp.postGain") ?? 0;
    if (jdspPostGain !== 0) setPostGain(jdspPostGain);
    if (Config.getConfig("jdsp.bassEnabled")) setBassBoost(true, Config.getConfig("jdsp.bassGain") ?? 6);
    if (Config.getConfig("jdsp.stereoEnabled")) setStereoEnhancement(true, Config.getConfig("jdsp.stereoMix") ?? 0.3);
    if (Config.getConfig("jdsp.reverbEnabled")) {
        // 算法混响恢复：存储为 UI 索引（0=小房间），下发原生 +1 跳过 None/0；旧数据整体偏移一格，越界值（旧 19=水下）clamp 到列表末项兜底
        const uiPreset = Math.min(Config.getConfig("jdsp.reverbPreset") ?? 0, REVERB_PRESETS.length - 1);
        setReverb(true, uiPreset + 1);
    }
    if (Config.getConfig("jdsp.tubeEnabled")) setVacuumTube(true, Config.getConfig("jdsp.tubeGain") ?? 6);
    if (Config.getConfig("jdsp.crossfeedEnabled")) setCrossfeed(true, Config.getConfig("jdsp.crossfeedMode") ?? 0);
    // JamesDSP DDC 耳机补偿恢复（与卷积混响互斥，共用 Convolver）
    const ddcEnabled = Config.getConfig("jdsp.ddcEnabled") ?? false;
    if (ddcEnabled) {
        const selection = Config.getConfig("jdsp.ddcHeadphone") ?? 0;
        const builtins = DDC_HEADPHONES.length;
        if (selection < builtins) {
            const hp = DDC_HEADPHONES[selection];
            if (hp) {
                loadBuiltinIR(hp.file).then(ok => {
                    if (ok) setConvolver(true);
                });
            }
        } else {
            const custom = ddcCustomList();
            const item = custom[selection - builtins];
            if (item) {
                RNFS.readFile(pathConst.ddcCustomPath + item.file, "base64")
                    .then(b64 => (b64 ? loadIR(b64) : Promise.resolve(false)))
                    .then(ok => {
                        if (ok) setConvolver(true);
                        else setConvolver(false);
                    })
                    .catch(() => setConvolver(false));
            }
        }
    } else if (Config.getConfig("jdsp.convolverEnabled")) {
        const presetIdx = Config.getConfig("jdsp.convolverPreset") ?? 0;
        const preset = IR_PRESETS[presetIdx];
        if (preset) {
            loadBuiltinIR(preset.file).then(ok => {
                if (ok) setConvolver(true);
            });
        }
    }
}

/** 均衡器关闭渐变定时器（避免快速切换时多个渐变竞态） */
let eqFadeTimer: ReturnType<typeof setTimeout> | null = null;

/** 开关/滑块的即改即生效入口（未绑定则只写配置，绑定后自动应用） */
export function applyEqEnabled(enabled: boolean) {
    Config.setConfig("sound.eqEnabled", enabled);
    // 取消上一次未完成的渐变
    if (eqFadeTimer) {
        clearTimeout(eqFadeTimer);
        eqFadeTimer = null;
    }
    if (enabled) {
        const preset = Config.getConfig("sound.eqPreset") ?? -1;
        if (typeof preset === "number" && preset >= 0) {
            const p = EQ_PRESETS[preset];
            if (p) jdspSetEqualizer(true, toJamesDspGains(p.bands));
        } else {
            const bands15 = Config.getConfig("jdsp.eqBands") ?? new Array(15).fill(0);
            jdspSetEqualizer(true, bands15);
        }
    } else {
        jdspSetEqualizer(false, new Array(15).fill(0));
    }
}

export function applyEqPreset(index: number) {
    // index: -1 = 手动(自定义)，>=0 = 内置预设（EQ_PRESETS[index]，0..N-1）
    Config.setConfig("sound.eqPreset", index);
    if (Config.getConfig("sound.eqEnabled")) {
        if (index >= 0) {
            // 应用内置预设：旧 10 段毫分贝 → 15 段 dB（线性插值）
            const p = EQ_PRESETS[index];
            if (p) {
                const bands15 = toJamesDspGains(p.bands);
                jdspSetEqualizer(true, bands15);
            }
        } else {
            // 切回自定义：按 jdsp.eqBands 重放
            const bands15 = Config.getConfig("jdsp.eqBands") ?? new Array(15).fill(0);
            jdspSetEqualizer(true, bands15);
        }
    }
}

export function applyBandLevel(band: number, level: number) {
    // level 是毫分贝（滑块值），转换为 dB 存储
    const bands15 = Config.getConfig("jdsp.eqBands") ?? new Array(15).fill(0);
    bands15[band] = level / 100;
    Config.setConfig("jdsp.eqBands", bands15);
    // 切到自定义模式
    Config.setConfig("sound.eqPreset", -1);
    // 直接调用 JamesDSP（15段 dB）
    if (Config.getConfig("sound.eqEnabled")) {
        jdspSetEqualizer(true, bands15);
    }
}

/** 用户导入的耳机补偿预设列表（持久化于 Config jdsp.ddcCustom） */
export function ddcCustomList(): { name: string; file: string }[] {
    return Config.getConfig("jdsp.ddcCustom") ?? [];
}

/** 从本地 wav 导入耳机补偿预设：复制到内部存储并记录，返回是否成功 */
export async function importDdcPreset(srcPath: string): Promise<boolean> {
    if (!srcPath.toLowerCase().endsWith(".wav")) return false;
    try {
        const dir = pathConst.ddcCustomPath;
        if (!(await exists(dir))) {
            await mkdir(dir);
        }
        const base = getFileName(srcPath);
        const name = (base.replace(/\.wav$/i, "") || "未命名").trim();
        // 用时间戳前缀避免文件名冲突
        const unique = `${Date.now()}_${base}`;
        await copyFile(srcPath, dir + unique);
        Config.setConfig("jdsp.ddcCustom", [
            ...ddcCustomList(),
            { name, file: unique },
        ]);
        return true;
    } catch (e) {
        errorLog("importDdcPreset", e);
        return false;
    }
}

/**
 * 删除用户导入的耳机补偿预设。
 * @param index 导入列表内的索引（非全局选中索引）
 */
export function deleteDdcPreset(index: number) {
    const list = ddcCustomList();
    const item = list[index];
    if (!item) return;
    const builtins = DDC_HEADPHONES.length;
    const current = (Config.getConfig("jdsp.ddcHeadphone") as number) ?? 0;
    const ddcOn = Config.getConfig("jdsp.ddcEnabled") ?? false;
    // 删的正是当前正在用的导入款 → 先关闭 DDC
    if (ddcOn && current >= builtins && current - builtins === index) {
        Config.setConfig("jdsp.ddcEnabled", false);
        setConvolver(false);
    }
    try {
        unlink(pathConst.ddcCustomPath + item.file);
    } catch (e) {
        errorLog("deleteDdcPreset.unlink", e);
    }
    const rest = list.filter((_, i) => i !== index);
    Config.setConfig("jdsp.ddcCustom", rest);
    // 删除位于当前选中导入项之前的项 → 选中索引左移，保持指向同一款
    if (ddcOn && current >= builtins) {
        const offset = current - builtins;
        if (offset > index) {
            Config.setConfig("jdsp.ddcHeadphone", builtins + offset - 1);
        }
    }
}

/** ViPER-DDC 耳机补偿（与卷积混响互斥，共用 Convolver）。selection 为统一索引：前 N 个内置 + 其后用户导入。 */
export async function applyDdc(enabled: boolean, selection: number) {
    Config.setConfig("jdsp.ddcEnabled", enabled);
    Config.setConfig("jdsp.ddcHeadphone", selection);
    if (enabled) {
        // 互斥：关闭卷积混响（同一 Convolver 不能同时跑两种 IR）
        Config.setConfig("jdsp.convolverEnabled", false);
        const builtins = DDC_HEADPHONES.length;
        let loaded = false;
        if (selection < builtins) {
            const hp = DDC_HEADPHONES[selection];
            if (hp) loaded = await loadBuiltinIR(hp.file);
        } else {
            const custom = ddcCustomList();
            const item = custom[selection - builtins];
            if (item) {
                const b64 = await RNFS.readFile(
                    pathConst.ddcCustomPath + item.file,
                    "base64",
                );
                if (b64) loaded = await loadIR(b64);
            }
        }
        if (loaded) {
            setConvolver(true);
        } else {
            setConvolver(false);
            Toast.warn(i18n.t("toast.irLoadFail"));
        }
    } else {
        setConvolver(false);
    }
}

/** 混响引擎（0=算法混响 Progenitor2，1=卷积混响 Convolver） */
export const REVERB_ENGINE_ALGORITHM = 0;
export const REVERB_ENGINE_CONVOLVER = 1;

/**
 * 合并后的混响开关：统一入口，算法混响与卷积混响二选一。
 * @param enabled 总开关
 * @param engine  引擎类型 0=算法 1=卷积
 * @param preset  对应引擎预设的 **UI 索引**（算法→REVERB_PRESETS 索引 0=小房间，底层下发时 +1 跳过原生 None/0；卷积→IR_PRESETS 索引，映射不变）
 */
export async function applyReverb(enabled: boolean, engine: number, preset: number) {
    // 先全部关闭，保证互斥
    Config.setConfig("jdsp.reverbEnabled", false);
    Config.setConfig("jdsp.convolverEnabled", false);
    setReverb(false, preset);
    setConvolver(false);

    if (!enabled) return;
    Config.setConfig("jdsp.reverbEngine", engine);
    if (engine === REVERB_ENGINE_ALGORITHM) {
        Config.setConfig("jdsp.reverbEnabled", true);
        Config.setConfig("jdsp.reverbPreset", preset);
        // 算法混响：REVERB_PRESETS 已去掉"关闭"，UI 索引 0=小房间；原生 JamesDSP 预设 0=None，下发 +1（小房间=1 … 水下=19）
        setReverb(true, preset + 1);
    } else {
        // 卷积与 DDC 共用 Convolver，互斥
        Config.setConfig("jdsp.ddcEnabled", false);
        const p = IR_PRESETS[preset];
        if (!p) return;
        const loaded = await loadBuiltinIR(p.file);
        if (!loaded) {
            Toast.warn(i18n.t("toast.irLoadFail"));
            return;
        }
        Config.setConfig("jdsp.convolverEnabled", true);
        Config.setConfig("jdsp.convolverPreset", preset);
        setConvolver(true);
    }
}

/** 手动模式下默认 bands（与设备频段数对齐，全 0） */
export function initBandsIfNeeded(count: number) {
    if (!count) return;
    const bands = Config.getConfig("sound.eqBands") ?? [];
    if (!Array.isArray(bands) || bands.length !== count) {
        Config.setConfig("sound.eqBands", new Array(count).fill(0));
    }
}

/** 播放器重建（少见）时重置绑定状态 */
export function resetSoundEffectBinding() {
    attached = false;
    infoCache = null;
}
