import { NativeModules, Platform } from "react-native";
import Config from "@/core/appConfig";
import { errorLog, trace } from "@/utils/log";

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
} | null = null;
let lastError: string | null = null;

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

/** 效果器能力信息（首次成功缓存；未绑定返回 null） */
export async function getSoundEffectInfo() {
    if (infoCache) return infoCache;
    if (Platform.OS !== "android" || !SoundEffect) return null;
    try {
        const info = await SoundEffect.getInfo();
        if (!info) return null;
        infoCache = {
            bands: info.bands ?? 0,
            centerFreqs: info.centerFreqs ?? [],
            presets: info.presets ?? [],
            levelMin: info.levelMin ?? -1500,
            levelMax: info.levelMax ?? 1500,
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
    if (Platform.OS !== "android" || !SoundEffect) return;
    const enabled = !!Config.getConfig("sound.eqEnabled");
    const preset = Config.getConfig("sound.eqPreset") ?? -1;
    const bands = Config.getConfig("sound.eqBands") ?? [];
    const bass = Config.getConfig("sound.bassBoost") ?? 0;
    const virtualizer = Config.getConfig("sound.virtualizer") ?? 0;

    if (enabled) {
        if (typeof preset === "number" && preset >= 0) {
            // 内置预设：逐段应用预设曲线
            const p = EQ_PRESETS[preset];
            if (p) {
                p.bands.forEach((level: number, i: number) => {
                    SoundEffect.setBandLevel(i, level);
                });
            }
        } else if (Array.isArray(bands) && bands.length > 0) {
            // 手动：应用用户拖动的频段
            bands.forEach((level: number, i: number) => {
                if (typeof level === "number") {
                    SoundEffect.setBandLevel(i, level);
                }
            });
        }
    }
    SoundEffect.setBassBoost(bass);
    SoundEffect.setVirtualizer(virtualizer);
    SoundEffect.setEqEnabled(enabled);
}

/** 开关/滑块的即改即生效入口（未绑定则只写配置，绑定后自动应用） */
export function applyEqEnabled(enabled: boolean) {
    Config.setConfig("sound.eqEnabled", enabled);
    if (attached && SoundEffect) SoundEffect.setEqEnabled(enabled);
}

export function applyEqPreset(index: number) {
    // index: -1 = 手动，>=0 = 内置预设（EQ_PRESETS[index]，0..N-1）
    Config.setConfig("sound.eqPreset", index);
    if (attached && SoundEffect) {
        const bands = Config.getConfig("sound.eqBands") ?? [];
        if (index >= 0) {
            // 应用内置预设曲线（设备频段少时截取前 N 段近似）
            const p = EQ_PRESETS[index];
            if (p) {
                p.bands.forEach((level: number, i: number) => {
                    bands[i] = level;
                    SoundEffect.setBandLevel(i, level);
                });
                Config.setConfig("sound.eqBands", bands);
            }
        } else {
            // 切回手动：按现有 bands 重放
            bands.forEach((level: number, i: number) => {
                if (typeof level === "number") SoundEffect.setBandLevel(i, level);
            });
        }
        SoundEffect.setEqEnabled(!!Config.getConfig("sound.eqEnabled"));
    }
}

export function applyBandLevel(band: number, level: number) {
    const bands = Config.getConfig("sound.eqBands") ?? [];
    bands[band] = level;
    Config.setConfig("sound.eqBands", bands);
    if (attached && SoundEffect) SoundEffect.setBandLevel(band, level);
}

export function applyBassBoost(strength: number) {
    Config.setConfig("sound.bassBoost", strength);
    if (attached && SoundEffect) SoundEffect.setBassBoost(strength);
}

export function applyVirtualizer(strength: number) {
    Config.setConfig("sound.virtualizer", strength);
    if (attached && SoundEffect) SoundEffect.setVirtualizer(strength);
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
