import { NativeModules } from "react-native";

const { JamesDSPModule } = NativeModules;

/**
 * JamesDSP JS 层封装
 *
 * 对应原生 JamesDSPModule，所有方法异步无返回（fire-and-forget）。
 * 效果器参数范围见各方法注释。
 */

// ==================== PostGain 输出增益 ====================

/** 输出增益 dB，范围 -12..+12，0=直通 */
export function setPostGain(gainDb: number): void {
    JamesDSPModule?.setPostGain(gainDb);
}

// ==================== Limiter 限幅器 ====================

/**
 * @param thresholdDb 阈值 dB，建议 -3..0，0=不限制
 * @param releaseMs   释放时间 ms，建议 50..300
 */
export function setLimiter(thresholdDb: number, releaseMs: number): void {
    JamesDSPModule?.setLimiter(thresholdDb, releaseMs);
}

// ==================== Equalizer 15段 ====================

/** 15段均衡器标准频率点（Hz） */
export const EQ_BANDS = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];

/**
 * @param enabled 是否启用
 * @param gains   15个频段增益 dB，顺序对应 EQ_BANDS
 */
export function setEqualizer(enabled: boolean, gains: number[]): void {
    const padded = [...gains];
    while (padded.length < 15) padded.push(0);
    JamesDSPModule?.setEqualizer(enabled, padded.slice(0, 15));
}

// ==================== BassBoost 动态低音 ====================

/**
 * @param enabled   是否启用
 * @param maxGainDb 最大低音增益 dB，范围 0..15
 */
export function setBassBoost(enabled: boolean, maxGainDb: number): void {
    JamesDSPModule?.setBassBoost(enabled, maxGainDb);
}

// ==================== StereoEnhancement 立体声增强 ====================

/**
 * @param enabled 是否启用
 * @param mix     混合比例 0..1，0=原音，1=最大增强
 */
export function setStereoEnhancement(enabled: boolean, mix: number): void {
    JamesDSPModule?.setStereoEnhancement(enabled, mix);
}

// ==================== Reverb 混响 ====================

/** 混响预设名称（Progenitor2，19个预设，中文；UI 索引 0 即"小房间"，底层下发时 +1 跳过原生 None） */
export const REVERB_PRESETS = [
    "小房间", "中房间", "大房间", "中厅",
    "大厅", "板式", "环境", "教堂", "大教堂",
    "地下室", "客厅", "石廊", "地毯厅", "仓库",
    "森林", "城市", "山脉", "深洞", "水下",
];

/**
 * @param enabled 是否启用
 * @param preset  原生预设编号 1..19（0=None 保留给原生，UI 不再暴露；调用方按 UI 索引 + 1 传入）
 */
export function setReverb(enabled: boolean, preset: number): void {
    JamesDSPModule?.setReverb(enabled, preset);
}

// ==================== Compressor 压缩器 ====================

/**
 * @param enabled      是否启用
 * @param fgtFacT      前向增益跟踪系数，建议 0.01..0.5
 * @param granularity  频域粒度，建议 4..8
 * @param tfResolution 时频分辨率，建议 2..6
 */
export function setCompressor(enabled: boolean, fgtFacT: number, granularity: number, tfResolution: number): void {
    JamesDSPModule?.setCompressor(enabled, fgtFacT, granularity, tfResolution);
}

// ==================== VacuumTube 电子管 ====================

/**
 * @param enabled 是否启用
 * @param dbGain  驱动增益 dB，范围 0..24，越大越暖
 */
export function setVacuumTube(enabled: boolean, dbGain: number): void {
    JamesDSPModule?.setVacuumTube(enabled, dbGain);
}

// ==================== Crossfeed 交叉馈送 ====================

/** 交叉馈送模式名称（中文） */
export const CROSSFEED_MODES = [
    "BS2B 一级", "BS2B 二级", "HRTF 交叉馈送",
    "HRTF 环绕 1", "HRTF 环绕 2", "HRTF 环绕 3",
];

/**
 * @param enabled 是否启用
 * @param mode    模式 0..5
 */
export function setCrossfeed(enabled: boolean, mode: number): void {
    JamesDSPModule?.setCrossfeed(enabled, mode);
}

// ==================== Convolver 卷积器 ====================

/** @param enabled 是否启用 */
export function setConvolver(enabled: boolean): void {
    JamesDSPModule?.setConvolver(enabled);
}

/**
 * 从 WAV 文件加载 IR（脉冲响应）到卷积器
 * @param wavBase64 WAV 文件的 Base64 编码
 * @returns 加载成功 true；格式不支持/解析失败 false
 */
export function loadIR(wavBase64: string): Promise<boolean> {
    return JamesDSPModule?.loadIR(wavBase64) ?? Promise.resolve(false);
}

/**
 * 加载内置 IR 预设（assets/ir/ 目录）
 * @param assetName 文件名，如 "ir_church.wav"
 * @returns 加载成功 true；assets 缺失/解析失败 false
 */
export function loadBuiltinIR(assetName: string): Promise<boolean> {
    return JamesDSPModule?.loadBuiltinIR(assetName) ?? Promise.resolve(false);
}

/** 内置卷积混响 IR 预设（中文名称） */
export const IR_PRESETS: { name: string; file: string }[] = [
    { name: "小房间", file: "ir_small_room.wav" },
    { name: "音乐厅", file: "ir_medium_hall.wav" },
    { name: "教堂", file: "ir_church.wav" },
    { name: "板式混响", file: "ir_plate.wav" },
    { name: "洞穴", file: "ir_cave.wav" },
];

// ==================== ViPER-DDC 耳机补偿 ====================

/**
 * 耳机频响补偿 IR 预设（assets/ir/ddc/ 目录，AutoEQ 最小相位补偿 IR）
 * 与卷积混响共用 Convolver，二者互斥。
 */
export const DDC_HEADPHONES: { name: string; file: string }[] = [
    { name: "QCY T13", file: "ddc/qcy_t13.wav" },
    { name: "AirPods Pro 2", file: "ddc/airpods_pro2.wav" },
    { name: "Sony WH-1000XM4", file: "ddc/sony_wh1000xm4.wav" },
    { name: "Bose QC45", file: "ddc/bose_qc45.wav" },
    { name: "Sennheiser HD 650", file: "ddc/sennheiser_hd650.wav" },
];

// ==================== 便捷：全部关闭 ====================

/** 关闭所有 JamesDSP 效果器（恢复直通） */
export function resetAll(): void {
    setPostGain(0);
    setEqualizer(false, new Array(15).fill(0));
    setBassBoost(false, 0);
    setStereoEnhancement(false, 0);
    setReverb(false, 0);
    setCompressor(false, 0, 0, 0);
    setVacuumTube(false, 0);
    setCrossfeed(false, 0);
    setConvolver(false);
}
