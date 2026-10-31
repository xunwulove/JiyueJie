import React, { useEffect, useRef, useState } from "react";
import {
    AppState,
    Dimensions,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { PERMISSIONS, check, request } from "react-native-permissions";
import { useAtomValue } from "jotai";
import bootstrapAtom from "@/entry/bootstrap/bootstrap.atom";
import PersistStatus from "@/utils/persistStatus";
import NativeUtils from "@/native/utils";
import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeSwitch from "@/components/base/switch";
import useColors from "@/hooks/useColors";
import Color from "color";
import LocalMusicSheet from "@/core/localMusicSheet";
import { defaultScanFolders } from "@/core/scanSettings";
import PluginManager from "@/core/pluginManager";
import Toast from "@/utils/toast";
import i18n from "@/core/i18n";
import { isTabletScreen } from "@/utils/tablet";
import Config from "@/core/appConfig";

/**
 * 首次启动引导页（Onboarding）
 * - 触发：bootstrap 完成后，`app.onboardingDone` 未设置 → 立即展示（无自绘启动页，直接接管）
 * - 结构：3 屏左右滑动（欢迎 → 权限 → 音源就绪），底部进度点 + 主按钮，左上角常驻"跳过"
 * - 权限：文件访问（存储）+ 通知（Android 13+），返回前台自动重查状态（复用权限弹窗逻辑）
 * - 完成：写 `app.onboardingDone = true`；"扫描本地音乐"默认开 → 引导结束自动扫描
 * - 跳过：不写完成标记，下次启动仍会提示（全程可跳过）
 */
const PAGE_COUNT = 3;

export default function Onboarding() {
    const bootstrapState = useAtomValue(bootstrapAtom);
    const colors = useColors();
    const primary = colors.primary;
    const isTablet = isTabletScreen();

    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const appState = useRef(AppState.currentState);

    // 文件访问 / 通知 权限状态
    const [storageGranted, setStorageGranted] = useState(false);
    const [notifyGranted, setNotifyGranted] = useState(
        Platform.OS !== "android" || Platform.Version < 33,
    );
    // 第 3 屏：扫描本地音乐（默认开）
    const [scanOnboarding, setScanOnboarding] = useState(true);
    // 第 3 屏：进入软件自动播放（默认跟随设置页配置：启动自动续播上次歌曲）
    const [autoPlay, setAutoPlay] = useState(
        () => Config.getConfig("basic.autoPlayWhenAppStart") ?? false,
    );
    // 第 3 屏：自动拉取默认订阅源（默认开，与设置页 basic.autoUpdatePlugin 同一配置）
    const [autoFetchPlugin, setAutoFetchPlugin] = useState(
        () => Config.getConfig("basic.autoUpdatePlugin") !== false,
    );
    // 第 3 屏：使用移动网络播放（默认跟随设置页配置，与设置页 basic.useCelluarNetworkPlay 同一配置）
    const [useCellularPlay, setUseCellularPlay] = useState(
        () => Config.getConfig("basic.useCelluarNetworkPlay") ?? true,
    );    const [checkingStorage, setCheckingStorage] = useState(false);

    /* 显隐：bootstrap Done 后立即接管（无自绘启动页，不做多余停留，尽量减少启动时间） */
    useEffect(() => {
        if (bootstrapState.state !== "Done") {
            return;
        }
        if (!PersistStatus.get("app.onboardingDone")) {
            setVisible(true);
        }
    }, [bootstrapState.state]);

    /* 权限状态检测 */
    const checkPermissions = async () => {
        // 文件访问
        try {
            const ok = await NativeUtils.checkStoragePermission();
            setStorageGranted(ok);
        } catch {
            // 保持原状态
        }
        // 通知（Android 13+）
        if (Platform.OS === "android" && Platform.Version >= 33) {
            try {
                const res = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
                setNotifyGranted(res === "granted");
            } catch {
                // 保持原状态
            }
        }
    };

    useEffect(() => {
        if (!visible) {
            return;
        }
        checkPermissions();
        const subscription = AppState.addEventListener(
            "change",
            nextAppState => {
                if (
                    appState.current.match(/inactive|background/) &&
                    nextAppState === "active"
                ) {
                    checkPermissions();
                }
                appState.current = nextAppState;
            },
        );
        return () => {
            subscription.remove();
        };
    }, [visible]);

    const requestStorage = async () => {
        setCheckingStorage(true);
        try {
            await NativeUtils.requestStoragePermission();
            // 系统弹框会失焦 → AppState 重查；此处延时兜底一次
            setTimeout(() => {
                checkPermissions();
                setCheckingStorage(false);
            }, 800);
        } catch {
            setCheckingStorage(false);
        }
    };

    const requestNotify = async () => {
        try {
            const res = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
            setNotifyGranted(res === "granted");
        } catch {
            // 用户拒绝/系统不支持，保持原状态
        }
    };

    /* 完成引导 */
    const finishOnboarding = () => {
        PersistStatus.set("app.onboardingDone", true);
        // 兼容旧"存储权限"开屏弹窗：引导页已覆盖权限说明，不再弹
        PersistStatus.set("app.skipBootstrapStorageDialog", true);
        // 写入"进入软件自动播放"偏好（与设置页 basic.autoPlayWhenAppStart 同一配置）
        Config.setConfig("basic.autoPlayWhenAppStart", autoPlay);
        // 自动拉取默认订阅源：开启 → 写配置并立即拉取一次；关闭 → 显式关闭启动自动更新
        Config.setConfig("basic.autoUpdatePlugin", autoFetchPlugin);
        // 写入"使用移动网络播放"偏好（与设置页 basic.useCelluarNetworkPlay 同一配置）
        Config.setConfig("basic.useCelluarNetworkPlay", useCellularPlay);
        if (autoFetchPlugin) {
            // 标记本次已拉取（避免 bootstrap 的每日一次逻辑重复拉）
            PersistStatus.set("app.pluginUpdateTime", Date.now());
            // 按订阅清单增量更新音源：解析清单 + name/version 对比 + 限并发下载（失败静默）
            PluginManager.updatePluginsFromSubscription().catch(() => {});
        }
        setVisible(false);
        if (scanOnboarding) {
            const folders = defaultScanFolders();
            if (folders.length) {
                LocalMusicSheet.importLocal(folders)
                    .then(count =>
                        Toast.success(
                            i18n.t("toast.scanComplete", { count }),
                        ),
                    )
                    .catch(() =>
                        Toast.warn(i18n.t("toast.scanFailOnboard")),
                    );
            }
        }
    };

    /* 跳过：不写完成标记，下次启动仍提示 */
    const skipOnboarding = () => {
        setVisible(false);
    };

    const goTo = (index: number) => {
        const width = Dimensions.get("window").width;
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
        setStep(index);
    };

    if (!visible) {
        return null;
    }

    const width = Dimensions.get("window").width;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#EAF0FA", "#F8F9FA"]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={styles.gradient}>
                {/* 装饰圆：左上 + 右下 半透明品牌色 */}
                <View
                    style={[
                        styles.decoCircle,
                        styles.decoTop,
                        { backgroundColor: Color(primary).alpha(0.08).toString() },
                    ]}
                />
                <View
                    style={[
                        styles.decoCircle,
                        styles.decoBottom,
                        { backgroundColor: Color(primary).alpha(0.06).toString() },
                    ]}
                />

                {/* 左上角跳过 */}
                <Pressable
                    style={styles.skipBtn}
                    onPress={skipOnboarding}
                    hitSlop={12}>
                    <ThemeText fontColor="textSecondary">跳过</ThemeText>
                </Pressable>

                {/* 三屏轮播 */}
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={e => {
                        const index = Math.round(
                            e.nativeEvent.contentOffset.x / width,
                        );
                        setStep(index);
                    }}>
                    {/* ===== 第 1 屏：欢迎 ===== */}
                    <View style={[styles.page, { width }]}>
                        <View style={styles.pageInner}>
                            <View style={styles.brandBlock}>
                                <View style={styles.brandIconWrap}>
                                    <Icon
                                        name="musical-note"
                                        size={64}
                                        color="#FFFFFF"
                                    />
                                </View>
                                <ThemeText
                                    fontSize="large"
                                    fontWeight="bold"
                                    style={styles.brandTitle}>
                                极悦界
                                </ThemeText>
                                <ThemeText
                                    fontSize="normal"
                                    fontColor="textSecondary"
                                    style={styles.brandSlogan}>
                                本地优先 · 多音源聚合 · 数据都在本机
                                </ThemeText>
                            </View>
                            <View
                                style={
                                    isTablet
                                        ? styles.featuresRow
                                        : styles.featureList
                                }>
                                {[
                                    {
                                        icon: "circle-stack" as IIconName,
                                        title: "导入音乐源",
                                        desc: "支持主流音源生态，一键订阅更新",
                                    },
                                    {
                                        icon: "magnifying-glass" as IIconName,
                                        title: "搜索全网歌曲",
                                        desc: "多源聚合搜索，自动择优播放",
                                    },
                                    {
                                        icon: "arrow-down-tray" as IIconName,
                                        title: "下载到本地",
                                        desc: "歌曲内嵌专辑图，离线也能听",
                                    },
                                ].map(f =>
                                    isTablet ? (
                                        <View
                                            key={f.title}
                                            style={styles.featureCardTablet}>
                                            <View
                                                style={[
                                                    styles.featureIconTablet,
                                                    { backgroundColor: Color(
                                                        primary,
                                                    )
                                                        .alpha(0.12)
                                                        .toString() },
                                                ]}>
                                                <Icon
                                                    name={f.icon}
                                                    size={22}
                                                    color={primary}
                                                />
                                            </View>
                                            <ThemeText
                                                fontWeight="bold"
                                                fontSize="normal"
                                                style={styles.featureCardTitle}>
                                                {f.title}
                                            </ThemeText>
                                            <ThemeText
                                                fontSize="description"
                                                fontColor="textSecondary"
                                                style={styles.featureCardDesc}>
                                                {f.desc}
                                            </ThemeText>
                                        </View>
                                    ) : (
                                        <View
                                            key={f.title}
                                            style={styles.featureRow}>
                                            <View
                                                style={[
                                                    styles.featureIcon,
                                                    { backgroundColor: Color(
                                                        primary,
                                                    )
                                                        .alpha(0.12)
                                                        .toString() },
                                                ]}>
                                                <Icon
                                                    name={f.icon}
                                                    size={22}
                                                    color={primary}
                                                />
                                            </View>
                                            <View style={styles.featureText}>
                                                <ThemeText fontWeight="bold">
                                                    {f.title}
                                                </ThemeText>
                                                <ThemeText
                                                    fontSize="description"
                                                    fontColor="textSecondary">
                                                    {f.desc}
                                                </ThemeText>
                                            </View>
                                        </View>
                                    ),
                                )}
                            </View>
                        </View>
                    </View>

                    {/* ===== 第 2 屏：权限 ===== */}
                    <View style={[styles.page, { width }]}>
                        <View style={styles.pageInner}>
                            <View
                                style={[
                                    styles.sectionHead,
                                    isTablet && styles.sectionHeadCenter,
                                ]}>
                                <ThemeText
                                    fontSize="large"
                                    fontWeight="bold"
                                    style={
                                        isTablet
                                            ? styles.sectionTitleCenter
                                            : undefined
                                    }>
                                授予必要权限
                                </ThemeText>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="textSecondary"
                                    style={[
                                        styles.sectionSub,
                                        isTablet && styles.sectionSubCenter,
                                    ]}>
                                只申请最核心的两项，其余权限用到时再引导
                                </ThemeText>
                            </View>
                            <View
                                style={[
                                    styles.permissionList,
                                    isTablet && styles.permissionRow,
                                ]}>
                                {/* 文件访问 */}
                                <View
                                    style={[
                                        styles.permissionCard,
                                        isTablet && styles.permissionCardTablet,
                                    ]}>
                                    <View
                                        style={[
                                            styles.permissionIcon,
                                            { backgroundColor: Color(primary)
                                                .alpha(0.12)
                                                .toString() },
                                        ]}>
                                        <Icon
                                            name="folder-music-outline"
                                            size={24}
                                            color={primary}
                                        />
                                    </View>
                                    <View style={styles.permissionText}>
                                        <ThemeText fontWeight="bold">
                                        文件访问
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                        扫描本地音乐，并把下载的歌曲保存到设备
                                        </ThemeText>
                                    </View>
                                    {storageGranted ? (
                                        <View style={styles.grantedWrap}>
                                            <Icon
                                                name="check-circle"
                                                size={18}
                                                color="#16A34A"
                                            />
                                            <ThemeText
                                                fontSize="description"
                                                style={{ color: "#16A34A" }}>
                                            已开启
                                            </ThemeText>
                                        </View>
                                    ) : (
                                        <Pressable
                                            onPress={requestStorage}
                                            disabled={checkingStorage}
                                            style={[
                                                styles.grantBtn,
                                                { backgroundColor: primary },
                                            ]}>
                                            <ThemeText
                                                fontSize="description"
                                                fontWeight="bold"
                                                color="#FFFFFF">
                                            去开启
                                            </ThemeText>
                                        </Pressable>
                                    )}
                                </View>

                                {/* 通知（Android 13+ 需申请；低版本无需权限，默认显示"已开启"，两项权限始终可见） */}
                                <View
                                    style={[
                                        styles.permissionCard,
                                        isTablet &&
                                        styles.permissionCardTablet,
                                    ]}>
                                    <View
                                        style={[
                                            styles.permissionIcon,
                                            { backgroundColor: Color(primary)
                                                .alpha(0.12)
                                                .toString() },
                                        ]}>
                                        <Icon
                                            name="chat-bubble-oval-left-ellipsis"
                                            size={24}
                                            color={primary}
                                        />
                                    </View>
                                    <View style={styles.permissionText}>
                                        <ThemeText fontWeight="bold">
                                            通知
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                            下载完成、后台播放时提醒你
                                        </ThemeText>
                                    </View>
                                    {notifyGranted ? (
                                        <View style={styles.grantedWrap}>
                                            <Icon
                                                name="check-circle"
                                                size={18}
                                                color="#16A34A"
                                            />
                                            <ThemeText
                                                fontSize="description"
                                                style={{ color: "#16A34A" }}>
                                                已开启
                                            </ThemeText>
                                        </View>
                                    ) : (
                                        <Pressable
                                            onPress={requestNotify}
                                            style={[
                                                styles.grantBtn,
                                                { backgroundColor: primary },
                                            ]}>
                                            <ThemeText
                                                fontSize="description"
                                                fontWeight="bold"
                                                color="#FFFFFF">
                                                去开启
                                            </ThemeText>
                                        </Pressable>
                                    )}
                                </View>
                            </View>

                            {/* 提示文字独立成行（不在卡片 flexWrap 行内，避免换行错位） */}
                            <ThemeText
                                fontSize="caption"
                                fontColor="textSecondary"
                                style={styles.permissionTip}>
                            未开启也不影响使用，之后可在「我的 → 设置 → 权限管理」补开
                            </ThemeText>
                        </View>
                    </View>

                    {/* ===== 第 3 屏：音源就绪 + 快速上手 ===== */}
                    <View style={[styles.page, { width }]}>
                        <View style={styles.pageInner}>
                            <View
                                style={[
                                    styles.sectionHead,
                                    isTablet && styles.sectionHeadCenter,
                                ]}>
                                <ThemeText
                                    fontSize="large"
                                    fontWeight="bold"
                                    style={
                                        isTablet
                                            ? styles.sectionTitleCenter
                                            : undefined
                                    }>
                                一切就绪
                                </ThemeText>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="textSecondary"
                                    style={[
                                        styles.sectionSub,
                                        isTablet && styles.sectionSubCenter,
                                    ]}>
                                打开即用的最后一步
                                </ThemeText>
                            </View>
                            <View style={styles.permissionList}>
                                {/* 自动更新音源开关（第 1 行，与设置页 basic.autoUpdatePlugin 同一配置） */}
                                <View style={styles.permissionCard}>
                                    <View
                                        style={[
                                            styles.permissionIcon,
                                            { backgroundColor: Color(primary)
                                                .alpha(0.12)
                                                .toString() },
                                        ]}>
                                        <Icon
                                            name="arrow-path"
                                            size={24}
                                            color={primary}
                                        />
                                    </View>
                                    <View style={styles.permissionText}>
                                        <ThemeText fontWeight="bold">
                                        自动更新音源
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                        引导完成后自动安装内置音源并保持每日更新
                                        </ThemeText>
                                    </View>
                                    <ThemeSwitch
                                        value={autoFetchPlugin}
                                        onValueChange={setAutoFetchPlugin}
                                    />
                                </View>

                                {/* 使用移动网络播放开关（与设置页 basic.useCelluarNetworkPlay 同一配置） */}
                                <View style={styles.permissionCard}>
                                    <View
                                        style={[
                                            styles.permissionIcon,
                                            { backgroundColor: Color(primary)
                                                .alpha(0.12)
                                                .toString() },
                                        ]}>
                                        <Icon
                                            name="wifi"
                                            size={24}
                                            color={primary}
                                        />
                                    </View>
                                    <View style={styles.permissionText}>
                                        <ThemeText fontWeight="bold">
                                        使用移动网络播放
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                        允许在移动数据（流量）下在线播放，适合车机 / 平板插卡场景
                                        </ThemeText>
                                    </View>
                                    <ThemeSwitch
                                        value={useCellularPlay}
                                        onValueChange={setUseCellularPlay}
                                    />
                                </View>

                                {/* 扫描本地音乐开关 */}
                                <View style={styles.permissionCard}>
                                    <View
                                        style={[
                                            styles.permissionIcon,
                                            { backgroundColor: Color(primary)
                                                .alpha(0.12)
                                                .toString() },
                                        ]}>
                                        <Icon
                                            name="musical-note"
                                            size={24}
                                            color={primary}
                                        />
                                    </View>
                                    <View style={styles.permissionText}>
                                        <ThemeText fontWeight="bold">
                                        扫描本地音乐
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                        引导结束后自动扫描设备音乐，可在音乐库随时重新扫描
                                        </ThemeText>
                                    </View>
                                    <ThemeSwitch
                                        value={scanOnboarding}
                                        onValueChange={setScanOnboarding}
                                    />
                                </View>

                                {/* 进入软件自动播放开关（与设置页 basic.autoPlayWhenAppStart 同一配置） */}
                                <View style={styles.permissionCard}>
                                    <View
                                        style={[
                                            styles.permissionIcon,
                                            { backgroundColor: Color(primary)
                                                .alpha(0.12)
                                                .toString() },
                                        ]}>
                                        <Icon
                                            name="play-circle"
                                            size={24}
                                            color={primary}
                                        />
                                    </View>
                                    <View style={styles.permissionText}>
                                        <ThemeText fontWeight="bold">
                                        进入软件自动播放
                                        </ThemeText>
                                        <ThemeText
                                            fontSize="description"
                                            fontColor="textSecondary">
                                        启动软件后自动续播上次的歌曲
                                        </ThemeText>
                                    </View>
                                    <ThemeSwitch
                                        value={autoPlay}
                                        onValueChange={setAutoPlay}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>

                {/* 底部：进度点 + 主按钮 */}
                <View
                    style={[
                        styles.footer,
                        isTablet && styles.footerTablet,
                    ]}>
                    <View style={styles.dots}>
                        {Array.from({ length: PAGE_COUNT }).map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === step
                                        ? [
                                            styles.dotActive,
                                            { backgroundColor: primary },
                                        ]
                                        : null,
                                ]}
                            />
                        ))}
                    </View>
                    <Pressable
                        onPress={() =>
                            step < PAGE_COUNT - 1
                                ? goTo(step + 1)
                                : finishOnboarding()
                        }
                        style={[
                            styles.mainBtn,
                            isTablet && styles.mainBtnTablet,
                            { backgroundColor: primary },
                        ]}>
                        <ThemeText
                            fontSize="normal"
                            fontWeight="bold"
                            color="#FFFFFF">
                            {step < PAGE_COUNT - 1 ? "下一步" : "开始使用"}
                        </ThemeText>
                    </Pressable>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99990,
        elevation: 99990,
    },
    gradient: {
        flex: 1,
    },
    decoCircle: {
        position: "absolute",
        borderRadius: 999,
    },
    decoTop: {
        width: 320,
        height: 320,
        top: -120,
        right: -100,
    },
    decoBottom: {
        width: 260,
        height: 260,
        bottom: -90,
        left: -80,
    },
    skipBtn: {
        position: "absolute",
        top: 44,
        right: 20,
        zIndex: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    page: {
        flex: 1,
        paddingTop: 96,
        paddingHorizontal: 28,
        justifyContent: "space-between",
    },
    /* 内容区限宽容器：统一 maxWidth 620 居中（宽屏/横屏也居中，不再偏左）；
       手机竖屏宽 <620 时 maxWidth 自然不触发，保持全宽不变 */
    pageInner: {
        flex: 1,
        justifyContent: "space-between",
        maxWidth: 620,
        width: "100%",
        alignSelf: "center",
    },
    /* 平板：第二/三屏标题区与第一屏品牌区视觉统一（居中） */
    sectionHeadCenter: {
        alignItems: "center",
    },
    sectionTitleCenter: {
        textAlign: "center",
    },
    sectionSubCenter: {
        textAlign: "center",
    },
    /* 第 1 屏：平板三列特征卡（图标在上，一眼看出是卡片不是按钮） */
    featuresRow: {
        flexDirection: "row",
        gap: 14,
        marginBottom: 48,
    },
    featureCardTablet: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 22,
        paddingHorizontal: 12,
        alignItems: "center",
        shadowColor: "#94A3B8",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    featureIconTablet: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    featureCardTitle: {
        textAlign: "center",
    },
    featureCardDesc: {
        textAlign: "center",
        marginTop: 4,
        lineHeight: 16,
    },
    /* 第 2 屏：平板权限卡并排 */
    permissionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 14,
    },
    permissionCardTablet: {
        flex: 1,
        minWidth: 250,
    },
    /* 第 1 屏 */
    brandBlock: {
        alignItems: "center",
        marginTop: 12,
    },
    brandIconWrap: {
        width: 96,
        height: 96,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2F6FED",
        shadowColor: "#2F6FED",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    brandTitle: {
        marginTop: 18,
        fontSize: 30,
    },
    brandSlogan: {
        marginTop: 8,
    },
    featureList: {
        marginBottom: 48,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
        shadowColor: "#94A3B8",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    featureIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    featureText: {
        flex: 1,
    },
    /* 第 2 / 3 屏 */
    sectionHead: {
        marginTop: 12,
    },
    sectionSub: {
        marginTop: 6,
    },
    permissionList: {
        marginBottom: 48,
    },
    permissionCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 14,
        shadowColor: "#94A3B8",
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    permissionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    permissionText: {
        flex: 1,
        marginRight: 12,
    },
    grantedWrap: {
        flexDirection: "row",
        alignItems: "center",
        columnGap: 4,
    },
    grantBtn: {
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    permissionTip: {
        marginTop: 4,
        paddingHorizontal: 4,
        lineHeight: 16,
    },
    /* 底部 */
    footer: {
        paddingHorizontal: 28,
        paddingBottom: 32,
        alignItems: "center",
    },
    footerTablet: {
        width: "100%",
        maxWidth: 620,
        alignSelf: "center",
    },
    dots: {
        flexDirection: "row",
        columnGap: 8,
        marginBottom: 20,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#CBD5E1",
    },
    dotActive: {
        width: 22,
    },
    mainBtn: {
        width: "100%",
        borderRadius: 999,
        paddingVertical: 14,
        alignItems: "center",
    },
    mainBtnTablet: {
        width: 280,
    },
});
