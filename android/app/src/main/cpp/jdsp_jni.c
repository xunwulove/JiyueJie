/*
 * JamesDSP JNI 桥接层 —— P2 完整效果器参数映射
 *
 * Kotlin 侧：com.doublesymmetry.kotlinaudio.jamesdsp.JamesDSPBridge
 * 核心库：jdsp_header.h 定义的 JamesDSPLib
 *
 * 效果器映射：
 *   Equalizer      → MultimodalEQ (15段 FIR/IIR)
 *   BassBoost      → DBB 动态低音
 *   Virtualizer    → StereoEnhancement + Crossfeed
 *   LoudnessEnh    → 废弃（PostGain 替代）
 *   Reverb         → Progenitor2 (20预设)
 *   DynamicsProc   → FFT Compressor
 *   Limiter        → JLimiter
 *   VacuumTube     → 电子管模拟
 *   Convolver      → 1D 卷积器（IR 文件后续）
 *   PostGain       → 输出增益
 */
#include <jni.h>
#include <stdlib.h>
#include <string.h>
#include "jdsp/jdsp_header.h"

#define TAG "JamesDSPJNI"
#include <android/log.h>
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

/* 全局 JamesDSP 实例（单例，音频处理线程访问） */
static JamesDSPLib *g_jdsp = NULL;
static int g_initialized = 0;

/* 标准 15 段均衡器频率点（Hz），含两端延伸点共 17 个 */
static const double EQ_FREQS[17] = {
    10.0, 25.0, 40.0, 63.0, 100.0, 160.0, 250.0, 400.0, 630.0,
    1000.0, 1600.0, 2500.0, 4000.0, 6300.0, 10000.0, 16000.0, 22000.0
};

#define JNI_FUNC(name) Java_com_doublesymmetry_kotlinaudio_jamesdsp_JamesDSPBridge_##name

/* ==================== 生命周期 ==================== */

JNIEXPORT jboolean JNICALL
JNI_FUNC(nativeInit)(JNIEnv *env, jobject thiz, jint blockSize, jfloat sampleRate)
{
    if (g_initialized) {
        LOGI("already initialized, re-init sampleRate=%.0f", sampleRate);
        JamesDSPFree(g_jdsp);
        free(g_jdsp);
        g_jdsp = NULL;
        g_initialized = 0;
    }
    g_jdsp = (JamesDSPLib *)malloc(sizeof(JamesDSPLib));
    if (!g_jdsp) { LOGE("malloc failed"); return JNI_FALSE; }
    memset(g_jdsp, 0, sizeof(JamesDSPLib));
    JamesDSPInit(g_jdsp, (int)blockSize, (float)sampleRate);
    g_initialized = 1;
    LOGI("nativeInit ok: blockSize=%d sr=%.0f", blockSize, sampleRate);
    return JNI_TRUE;
}

JNIEXPORT void JNICALL
JNI_FUNC(nativeFree)(JNIEnv *env, jobject thiz)
{
    if (g_jdsp) { JamesDSPFree(g_jdsp); free(g_jdsp); g_jdsp = NULL; }
    g_initialized = 0;
    LOGI("nativeFree done");
}

JNIEXPORT void JNICALL
JNI_FUNC(nativeProcess)(JNIEnv *env, jobject thiz, jobject input, jobject output, jint frames)
{
    if (!g_initialized || !g_jdsp) return;
    float *in = (float *)(*env)->GetDirectBufferAddress(env, input);
    float *out = (float *)(*env)->GetDirectBufferAddress(env, output);
    if (!in || !out) return;
    if (g_jdsp->processFloatMultiplexd)
        g_jdsp->processFloatMultiplexd(g_jdsp, in, out, (size_t)frames);
}

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetSampleRate)(JNIEnv *env, jobject thiz, jfloat sampleRate)
{
    if (!g_initialized || !g_jdsp) return;
    JamesDSPSetSampleRate(g_jdsp, (float)sampleRate, 1);
}

/* ==================== PostGain 输出增益 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetPostGain)(JNIEnv *env, jobject thiz, jfloat pGaindB)
{
    if (!g_initialized || !g_jdsp) return;
    JamesDSPSetPostGain(g_jdsp, (double)pGaindB);
}

/* ==================== Limiter 限幅器 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetLimiter)(JNIEnv *env, jobject thiz, jfloat thresholddB, jfloat msRelease)
{
    if (!g_initialized || !g_jdsp) return;
    JLimiterSetCoefficients(g_jdsp, (double)thresholddB, (double)msRelease);
}

/* ==================== Equalizer 15段 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetEqualizer)(JNIEnv *env, jobject thiz, jboolean enabled, jfloatArray gains)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) {
        MultimodalEqualizerDisable(g_jdsp);
        return;
    }
    jfloat *g = (*env)->GetFloatArrayElements(env, gains, NULL);
    if (!g) return;
    double gaindB[17];
    gaindB[0] = 0.0;       /* 10Hz 端点 */
    gaindB[16] = 0.0;      /* 22kHz 端点 */
    for (int i = 0; i < 15; i++) gaindB[i + 1] = (double)g[i];
    (*env)->ReleaseFloatArrayElements(env, gains, g, JNI_ABORT);
    /* interpolationMode=2(spline), operatingMode=0(IIR) */
    MultimodalEqualizerAxisInterpolation(g_jdsp, 2, 0, (double *)EQ_FREQS, gaindB);
    MultimodalEqualizerEnable(g_jdsp, 1);
}

/* ==================== BassBoost DBB 动态低音 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetBassBoost)(JNIEnv *env, jobject thiz, jboolean enabled, jfloat maxGain)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { BassBoostDisable(g_jdsp); return; }
    BassBoostSetParam(g_jdsp, (float)maxGain);
    BassBoostEnable(g_jdsp);
}

/* ==================== StereoEnhancement 立体声增强 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetStereoEnhancement)(JNIEnv *env, jobject thiz, jboolean enabled, jfloat mix)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { StereoEnhancementDisable(g_jdsp); return; }
    StereoEnhancementSetParam(g_jdsp, (float)mix);
    StereoEnhancementEnable(g_jdsp);
}

/* ==================== Reverb 混响 Progenitor2 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetReverb)(JNIEnv *env, jobject thiz, jboolean enabled, jint preset)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { ReverbDisable(g_jdsp); return; }
    Reverb_SetParam(g_jdsp, (int)preset);
    ReverbEnable(g_jdsp);
}

/* ==================== Compressor FFT 压缩器 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetCompressor)(JNIEnv *env, jobject thiz, jboolean enabled,
    jfloat fgtFacT, jint granularity, jint tfResolution)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { CompressorDisable(g_jdsp); return; }
    CompressorSetParam(g_jdsp, (float)fgtFacT, (int)granularity, (int)tfResolution, 1);
    CompressorEnable(g_jdsp, 1);
}

/* ==================== VacuumTube 电子管模拟 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetVacuumTube)(JNIEnv *env, jobject thiz, jboolean enabled, jfloat dbGain)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { VacuumTubeDisable(g_jdsp); return; }
    VacuumTubeSetGain(g_jdsp, (double)dbGain);
    VacuumTubeEnable(g_jdsp);
}

/* ==================== Crossfeed 交叉馈送 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetCrossfeed)(JNIEnv *env, jobject thiz, jboolean enabled, jint mode)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { CrossfeedDisable(g_jdsp); return; }
    CrossfeedChangeMode(g_jdsp, (int)mode);
    CrossfeedEnable(g_jdsp, 1);
}

/* ==================== Convolver 卷积器 ==================== */

JNIEXPORT void JNICALL
JNI_FUNC(nativeSetConvolver)(JNIEnv *env, jobject thiz, jboolean enabled)
{
    if (!g_initialized || !g_jdsp) return;
    if (!enabled) { Convolver1DDisable(g_jdsp); return; }
    Convolver1DEnable(g_jdsp);
}

/*
 * 加载 IR（脉冲响应）到卷积器
 * @param irFloat  归一化 float 数组（交错 L/R，单声道则复制到两声道）
 * @param channels 声道数（1=mono, 2=stereo）
 * @param length   采样点数（每声道）
 */
JNIEXPORT void JNICALL
JNI_FUNC(nativeLoadIR)(JNIEnv *env, jobject thiz, jfloatArray irFloat, jint channels, jint length)
{
    if (!g_initialized || !g_jdsp) return;
    if (length <= 0 || channels < 1 || channels > 2) return;

    jfloat *ir = (*env)->GetFloatArrayElements(env, irFloat, NULL);
    if (!ir) return;

    /* Convolver1DLoadImpulseResponse 需要交错 float（L,R,L,R...）
       单声道时复制为立体声 */
    unsigned int impChannels = (channels == 2) ? 2 : 1;
    int result = Convolver1DLoadImpulseResponse(
        g_jdsp, ir, impChannels, (size_t)length, 1);

    (*env)->ReleaseFloatArrayElements(env, irFloat, ir, JNI_ABORT);

    if (result == 0) {
        LOGI("nativeLoadIR ok: channels=%d length=%d", channels, length);
    } else {
        LOGE("nativeLoadIR failed: result=%d", result);
    }
}
