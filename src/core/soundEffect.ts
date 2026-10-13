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

/** 确保效果器已绑定（播放器就绪且有 session 时执行一次） */
export async function ensureSoundEffectAttached() {
    if (attached || Platform.OS !== "android" || !SoundEffect) return;
    try {
        const sessionId = await SoundEffect.getAudioSessionId();
        if (typeof sessionId === "number" && sessionId > 0) {
            SoundEffect.attach(sessionId);
            attached = true;
            applyAllConfig();
            trace("均衡器已绑定 session " + sessionId);
        }
    } catch (e: any) {
        // 播放器未就绪（如尚未播放过），下次播放再试
        trace("均衡器绑定暂缓: " + (e?.message ?? e));
    }
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
        errorLog("读取均衡器能力失败", e?.message ?? e);
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

    if (enabled && preset != null && preset >= 0) {
        SoundEffect.setPreset(preset);
    }
    if (enabled && Array.isArray(bands) && bands.length > 0) {
        bands.forEach((level: number, i: number) => {
            if (typeof level === "number") {
                SoundEffect.setBandLevel(i, level);
            }
        });
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
    Config.setConfig("sound.eqPreset", index);
    if (attached && SoundEffect) {
        if (index >= 0) {
            SoundEffect.setPreset(index);
        } else {
            // 切回手动：按现有 bands 重放
            const bands = Config.getConfig("sound.eqBands") ?? [];
            bands.forEach((level: number, i: number) => {
                if (typeof level === "number") SoundEffect.setBandLevel(i, level);
            });
            SoundEffect.setEqEnabled(!!Config.getConfig("sound.eqEnabled"));
        }
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
