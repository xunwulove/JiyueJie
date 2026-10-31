/**
 * 深度播放验证（独立 App「源鉴」）
 *
 * 对解析出的真实播放地址做「真实播放」验证：初始化播放器 → 加载 URL →
 * 等待进入 Playing 状态 → 持续播放 2s 无错误 → 判定该音源可播放。
 *
 * 设计约束：
 * - 全局单实例播放器 + 串行队列（RNTP 同一时间只能播一个，探测并发 worker 排队复用）
 * - 不经过全功能 TrackPlayer 封装（避免依赖注入与自动切歌副作用），直接驱动 RNTP 原生 API
 * - 超时 / 错误分类 / 可取消；播放器初始化失败时优雅降级（该源标记不可播放 + 原因）
 */
import ReactNativeTrackPlayer, {
    Event,
    State,
    Track,
} from "react-native-track-player";
import delay from "@/utils/delay";

/** 进入 Playing 状态的最长等待（毫秒） */
const PLAY_TIMEOUT = 20000;
/** 进入 Playing 后持续观察无错误的最短时长（毫秒） */
const PLAY_HOLD_MS = 2000;
/** 状态轮询间隔（毫秒） */
const POLL_INTERVAL = 300;

export interface IPlaybackVerifyResult {
    /** 是否真正可播放（进入 Playing 并持续无错） */
    playableOk: boolean;
    /** 失败原因（分类后） */
    playError?: string;
    /** 实际播放秒数 */
    playedSec: number;
    /** 播放器解析出的音频时长（秒） */
    durationSec: number;
    /** 验证耗时（毫秒） */
    verifyMs: number;
}

interface IPlaybackVerifyTask {
    url: string;
    headers?: Record<string, string>;
    resolve: (r: IPlaybackVerifyResult) => void;
}

let setupPromise: Promise<boolean> | null = null;
const queue: IPlaybackVerifyTask[] = [];
let pumping = false;

async function ensurePlayer(): Promise<boolean> {
    if (!setupPromise) {
        setupPromise = ReactNativeTrackPlayer.setupPlayer({ autoUpdateMetadata: false })
            .then(() => true)
            .catch(() => false);
    }
    return setupPromise;
}

/** 播放错误粗分类（便于报表直接阅读与后续人工复核） */
export function classifyPlayError(msg?: string): string {
    const m = (msg || "").toLowerCase();
    if (m.includes("403") || m.includes("forbidden")) {
        return "403 访问被拒";
    }
    if (m.includes("404") || m.includes("not found")) {
        return "404 资源不存在";
    }
    if (
        m.includes("network") ||
        m.includes("timeout") ||
        m.includes("connect") ||
        m.includes("socket") ||
        m.includes("dns") ||
        m.includes("unreachable")
    ) {
        return "网络错误";
    }
    if (
        m.includes("unsupported") ||
        m.includes("format") ||
        m.includes("codec") ||
        m.includes("decoder") ||
        m.includes("parse") ||
        m.includes("cannot play")
    ) {
        return "音频格式不支持";
    }
    if (
        m.includes("auth") ||
        m.includes("token") ||
        m.includes("sign") ||
        m.includes("invalid request")
    ) {
        return "鉴权/防盗链";
    }
    return msg || "播放器报错";
}

/**
 * 入队播放验证（全局串行：同一时间只播放一个 URL）。
 * 返回 Promise<IPlaybackVerifyResult>，队列内逐个执行。
 */
export function verifyPlayable(
    url: string,
    headers?: Record<string, string>,
): Promise<IPlaybackVerifyResult> {
    return new Promise(resolve => {
        queue.push({ url, headers, resolve });
        void pump();
    });
}

/** 试听中标记（与探测静音验证互斥：试听时探测队列拒绝入队，避免抢占播放器） */
let sampleActive = false;

/** 是否正在试听 */
export function isSampleActive(): boolean {
    return sampleActive;
}

/**
 * 简单播放（试听）：真实出声播放一段解析出的音频，不自动停止。
 * 复用全局播放器实例；探测队列（verifyPlayable）期间不可试听。
 * 播放中调用会先 reset 重播新 URL。
 */
export async function playSample(
    url: string,
    headers?: Record<string, string>,
): Promise<void> {
    if (pumping || queue.length > 0) {
        throw new Error("正在探测播放，请稍后再试听");
    }
    const playerOk = await ensurePlayer();
    if (!playerOk) {
        throw new Error("播放器初始化失败");
    }
    sampleActive = true;
    try {
        await ReactNativeTrackPlayer.reset();
        const track: Track = { url, title: "源鉴试听", artist: "源鉴" };
        if (headers && Object.keys(headers).length > 0) {
            track.headers = headers;
        }
        await ReactNativeTrackPlayer.setQueue([track]);
        await ReactNativeTrackPlayer.setVolume(1);
        await ReactNativeTrackPlayer.play();
    } catch (e) {
        sampleActive = false;
        throw e;
    }
}

/** 停止试听并复位播放器 */
export async function stopSample(): Promise<void> {
    sampleActive = false;
    try {
        await ReactNativeTrackPlayer.reset();
    } catch {}
}

async function pump() {
    if (pumping) {
        return;
    }
    pumping = true;
    try {
        while (queue.length > 0) {
            const task = queue.shift()!;
            const r = await doVerify(task);
            task.resolve(r);
        }
    } finally {
        pumping = false;
    }
}

async function doVerify(task: IPlaybackVerifyTask): Promise<IPlaybackVerifyResult> {
    const t0 = Date.now();
    const playerOk = await ensurePlayer();
    if (!playerOk) {
        return {
            playableOk: false,
            playError: "播放器初始化失败（跳过深度播放验证）",
            playedSec: 0,
            durationSec: 0,
            verifyMs: Date.now() - t0,
        };
    }

    let playError: string | null = null;
    let enteredPlaying = false;
    let durationSec = 0;

    const errUnsub = ReactNativeTrackPlayer.addEventListener(
        Event.PlaybackError,
        e => {
            if (!playError) {
                playError = classifyPlayError(e.message);
            }
        },
    );

    try {
        await ReactNativeTrackPlayer.reset();
        const track: Track = {
            url: task.url,
            title: "probe",
            artist: "probe",
        };
        if (task.headers && Object.keys(task.headers).length > 0) {
            track.headers = task.headers;
        }
        await ReactNativeTrackPlayer.setQueue([track]);
        // 探测静音：验证只依赖缓冲/解码/状态机（进入 Playing + 持续无错），
        // 与输出音量无关——置 0 避免探测过程突然出声
        await ReactNativeTrackPlayer.setVolume(0);
        await ReactNativeTrackPlayer.play();

        // 阶段 1：等待进入 Playing（或错误/超时）
        const deadline = Date.now() + PLAY_TIMEOUT;
        while (Date.now() < deadline) {
            if (playError) {
                break;
            }
            const state = (await ReactNativeTrackPlayer.getPlaybackState()).state;
            if (state === State.Playing) {
                enteredPlaying = true;
                break;
            }
            if (
                state === State.Error ||
                state === State.None ||
                state === State.Stopped
            ) {
                playError = playError ?? "播放器状态异常（" + state + "）";
                break;
            }
            await delay(POLL_INTERVAL);
        }

        if (playError) {
            return {
                playableOk: false,
                playError,
                playedSec: 0,
                durationSec,
                verifyMs: Date.now() - t0,
            };
        }
        if (!enteredPlaying) {
            return {
                playableOk: false,
                playError: "缓冲超时（20s 未进入播放状态）",
                playedSec: 0,
                durationSec,
                verifyMs: Date.now() - t0,
            };
        }

        // 阶段 2：已进入 Playing，读取时长并持续观察 PLAY_HOLD_MS 无错误
        try {
            const progress = await ReactNativeTrackPlayer.getProgress();
            if (progress && Number.isFinite(progress.duration) && progress.duration > 0) {
                durationSec = progress.duration;
            }
        } catch {
            // 拿不到时长不影响播放判定
        }
        const holdUntil = Date.now() + PLAY_HOLD_MS;
        while (Date.now() < holdUntil) {
            if (playError) {
                break;
            }
            await delay(POLL_INTERVAL);
        }

        if (playError) {
            return {
                playableOk: false,
                playError,
                playedSec: 0,
                durationSec,
                verifyMs: Date.now() - t0,
            };
        }
        return {
            playableOk: true,
            playedSec: PLAY_HOLD_MS / 1000,
            durationSec,
            verifyMs: Date.now() - t0,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "timeout") {
            return {
                playableOk: false,
                playError: "缓冲超时（20s 未进入播放状态）",
                playedSec: 0,
                durationSec,
                verifyMs: Date.now() - t0,
            };
        }
        return {
            playableOk: false,
            playError: classifyPlayError(msg),
            playedSec: 0,
            durationSec,
            verifyMs: Date.now() - t0,
        };
    } finally {
        errUnsub.remove();
        try {
            await ReactNativeTrackPlayer.reset();
        } catch {
            // 清理失败不阻塞
        }
    }
}
