import { NativeModule, NativeModules } from "react-native";

interface IProbePlayer extends NativeModule {
    /**
     * 独立 ExoPlayer 静默播放验证（方案 B）
     * @param url 解析出的音频播放地址
     * @param headers 音源要求的请求头（防盗链 UA/referer/cookie 等），无则传 null
     * @param timeoutMs 单次验证总超时（毫秒，原生侧会夹到 3000~60000）
     * @returns 播放位置推进 ≥2s 无错误 → true
     */
    probeUrl(
        url: string,
        headers: Record<string, string> | null,
        timeoutMs: number,
    ): Promise<boolean>;
}

const ProbePlayer = NativeModules.ProbePlayer as IProbePlayer;

export default ProbePlayer;
