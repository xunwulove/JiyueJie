import React, { useEffect, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import useColors from "@/hooks/useColors";
import useIsTablet from "@/hooks/useIsTablet";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog } from "@/components/dialogs/useDialog";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
import MusicSheet, { useSheetsBase } from "@/core/musicSheet";
import LocalMusicSheet from "@/core/localMusicSheet";
import { useMusicHistory } from "@/core/musicHistory";
import { checkUpdateAndShowResult } from "@/hooks/useCheckUpdate";
import PersistStatus from "@/utils/persistStatus";
import DeviceInfo from "react-native-device-info";
import pluginManager, { usePlugins } from "@/core/pluginManager";
import { useDownloadedList } from "@/core/downloader";

/**
 * 我的页 - 复刻 APlayer MinePage：
 * 平板：用户双大卡片（头像/昵称 + 版本/检查更新）→ "我的音乐"3 卡行 → "数据与设置"3 卡行（MineEntryCard 统计卡款）
 * 手机：单长条用户卡 → MineStatCard 3 卡行 → "我的音乐" 卡片竖排入口列表（MineEntryItem）
 * 记录：fork 无歌单管理/备份管理二级页，入口按 fork 现有能力映射；右箭头图标集缺失省略
 */
interface IEntry {
    icon: IIconName;
    title: string;
    value?: string;
    action: () => void;
}

export default function MineTab({
}: {
    /** 旧入口（已废弃）：我的歌单现走独立歌单管理页 SHEET_MANAGER */
    onGoSheets?: () => void;
}) {
    const colors = useColors();
    const navigate = useNavigate();
    const isTablet = useIsTablet();
    const primary = colors.primary;

    const sheetsBase = useSheetsBase();
    const favCount =
        sheetsBase.find(s => s.id === MusicSheet.defaultSheet.id)?.worksNum ?? 0;
    const history = useMusicHistory();
    const localMusicList = LocalMusicSheet.useMusicList();

    // 音源数（已启用插件数，响应式）+ 已下载歌曲数（响应式）
    const plugins = usePlugins();
    const enabledPluginCount = plugins.filter(p =>
        pluginManager.isPluginEnabled(p),
    ).length;
    const downloadedList = useDownloadedList();

    // 设备名称（异步获取，兜底品牌+型号）+ 系统信息（同步 API）
    const [deviceName, setDeviceName] = useState("");
    useEffect(() => {
        let mounted = true;
        DeviceInfo.getDeviceName()
            .then(name => {
                if (mounted && name) {
                    setDeviceName(name);
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);
    const deviceTitle =
        deviceName || `${DeviceInfo.getBrand()} ${DeviceInfo.getModel()}`.trim();
    const systemInfo = `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`.trim();

    const onCheckUpdate = () => checkUpdateAndShowResult(true);

    // 最近一次检查更新结果（供平板版本卡动态显示："发现新版本"/"已是最新"）
    const updateCheckResult = PersistStatus.useValue(
        "app.updateCheckResult",
    );

    const favoriteAction = () =>
        navigate(ROUTE_PATH.LOCAL_SHEET_DETAIL, {
            id: MusicSheet.defaultSheet.id,
        });

    /* 平板两组入口卡 - "我的音乐"组（对齐 APlayer MinePage 第 1 组：我的歌单/我的喜欢/下载管理） */
    const mineCards: IEntry[] = [
        {
            icon: "playlist",
            title: "我的歌单",
            value: `${sheetsBase.length} 个歌单`,
            action: () => navigate(ROUTE_PATH.SHEET_MANAGER),
        },
        {
            icon: "heart",
            title: "我的喜欢",
            value: `${favCount} 首收藏`,
            action: favoriteAction,
        },
        {
            icon: "arrow-down-tray",
            title: "下载管理",
            value: "已下载",
            action: () => navigate(ROUTE_PATH.DOWNLOADING),
        },
    ];
    /* "数据与设置"组（对齐 APlayer MinePage 第 2 组：导入歌单/备份管理/音源管理，工具卡灰调 subtle） */
    const toolCards: IEntry[] = [
        {
            icon: "inbox-arrow-down",
            title: "导入歌单/单曲",
            value: "自动识别音源",
            action: () => showDialog("ImportMusicSheetDialog"),
        },
        {
            icon: "arrow-up-tray",
            title: "备份管理",
            value: "WebDAV · 本地",
            action: () => navigate(ROUTE_PATH.BACKUP),
        },
        {
            icon: "server-stack",
            title: "音源管理",
            value: "插件 · 订阅",
            action: () => navigate(ROUTE_PATH.PLUGIN_SOURCES),
        },
    ];

    /* 手机统计 3 卡（MineStatCard compact） */
    const statCards: IEntry[] = [
        {
            icon: "clock-outline",
            title: "最近播放",
            value: `${history.length} 首`,
            action: () => navigate(ROUTE_PATH.HISTORY),
        },
        {
            icon: "heart",
            title: "我的喜欢",
            value: `${favCount} 首收藏`,
            action: favoriteAction,
        },
        {
            icon: "musical-note",
            title: "本地音乐",
            value: `${localMusicList?.length ?? 0} 首`,
            action: () => navigate(ROUTE_PATH.LOCAL),
        },
    ];

    /* 手机竖排入口列表（对齐 APlayer 手机"我的音乐"卡：播放队列/我的喜欢/导入歌单/备份管理/下载管理/音源管理） */
    const entryItems: IEntry[] = [
        {
            icon: "playlist",
            title: "播放队列",
            action: () => showPanel("PlayList"),
        },
        {
            icon: "heart",
            title: "我的喜欢",
            action: favoriteAction,
        },
        {
            icon: "inbox-arrow-down",
            title: "导入歌单/单曲",
            action: () => showDialog("ImportMusicSheetDialog"),
        },
        {
            icon: "arrow-up-tray",
            title: "备份管理",
            action: () => navigate(ROUTE_PATH.BACKUP),
        },
        {
            icon: "arrow-down-tray",
            title: "下载管理",
            action: () => navigate(ROUTE_PATH.DOWNLOADING),
        },
        {
            icon: "server-stack",
            title: "音源管理",
            action: () => navigate(ROUTE_PATH.PLUGIN_SOURCES),
        },
    ];

    /* ---- 用户卡（平板两卡并排 / 手机单长条含版本） ---- */
    const avatarBox = (
        <View style={[styles.avatar, { backgroundColor: primary }]}>
            <ThemeText fontWeight="bold" fontSize="large" color="#FFFFFF">
                极
            </ThemeText>
        </View>
    );
    /* 用户卡信息区：平板显示标题+副标题；手机副标题统一放底部行（避免与右上齿轮/底部重复叠字） */
    /* 字号规范（对齐三卡 MineEntryCard）：大卡标题统一 large(22)/bold，副标题统一 normal(16) */
    const userInfo = (withDesc: boolean) => (
        <View style={styles.userInfo}>
            <ThemeText fontSize="large" fontWeight="bold" numberOfLines={1}>
                {systemInfo}
            </ThemeText>
            {withDesc ? (
                <ThemeText
                    fontSize="normal"
                    fontColor="textSecondary"
                    numberOfLines={1}>
                    {deviceTitle}
                </ThemeText>
            ) : null}
        </View>
    );
    /* 手机端设置齿轮（流内布局放行尾，避免 absolute 悬浮盖住标题文字） */
    const settingGear = !isTablet ? (
        <Pressable
            style={styles.settingGear}
            onPress={() => navigate(ROUTE_PATH.SETTING, { type: "basic" })}
            hitSlop={8}>
            <Icon
                name="cog-8-tooth"
                size={22}
                color={colors.textSecondary}
            />
        </Pressable>
    ) : null;
    /* 三格统计行（平板/手机共用：音源 / 本地音乐 / 已下载） */
    const statsRow = (
        <View style={styles.userStatsRow}>
            <View style={styles.userStatItem}>
                <ThemeText fontSize="large" fontWeight="bold" color={primary}>
                    {enabledPluginCount}
                </ThemeText>
                <ThemeText fontSize="caption" fontColor="textSecondary">
                    音源
                </ThemeText>
            </View>
            <View style={styles.userStatItem}>
                <ThemeText fontSize="large" fontWeight="bold" color={primary}>
                    {localMusicList.length}
                </ThemeText>
                <ThemeText fontSize="caption" fontColor="textSecondary">
                    本地音乐
                </ThemeText>
            </View>
            <View style={styles.userStatItem}>
                <ThemeText fontSize="large" fontWeight="bold" color={primary}>
                    {downloadedList.length}
                </ThemeText>
                <ThemeText fontSize="caption" fontColor="textSecondary">
                    已下载
                </ThemeText>
            </View>
        </View>
    );
    const userCard = (
        <LinearGradient
            colors={[
                Color(primary).alpha(0.18).toString(),
                Color(primary).alpha(0.05).toString(),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
                styles.userCard,
                {
                    borderColor: Color(
                        (colors as any).divider ?? "#E2E8F0",
                    )
                        .alpha(0.35)
                        .toString(),
                },
            ]}>
            <View style={styles.userCardTop}>
                {avatarBox}
                {/* 平板左卡副标题显示系统信息；手机副标题统一放底部行（避免顶部/底部重复叠字） */}
                {userInfo(isTablet)}
                {settingGear}
            </View>
            {!isTablet ? (
                <>
                    {statsRow}
                    <View style={styles.userCardBottom}>
                        <ThemeText
                            fontSize="normal"
                            fontColor="textSecondary"
                            numberOfLines={1}
                            style={styles.userCardBottomText}>
                            {deviceTitle}
                        </ThemeText>
                        <View style={styles.versionRow}>
                            <ThemeText
                                fontSize="large"
                                fontWeight="bold"
                                color={primary}>
                                v{DeviceInfo.getVersion()}
                            </ThemeText>
                            <Pressable
                                onPress={onCheckUpdate}
                                style={[
                                    styles.updateChip,
                                    {
                                        backgroundColor: Color(primary)
                                            .alpha(0.1)
                                            .toString(),
                                    },
                                ]}>
                                <ThemeText
                                    fontSize="normal"
                                    fontWeight="medium"
                                    color={primary}>
                                    检查更新
                                </ThemeText>
                            </Pressable>
                        </View>
                    </View>
                </>
            ) : (
                statsRow
            )}
        </LinearGradient>
    );
    const versionCard = isTablet ? (
        <LinearGradient
            colors={[
                Color(primary).alpha(0.18).toString(),
                Color(primary).alpha(0.05).toString(),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
                styles.userCard,
                {
                    borderColor: Color(
                        (colors as any).divider ?? "#E2E8F0",
                    )
                        .alpha(0.35)
                        .toString(),
                },
            ]}>
            <View style={styles.userCardTop}>
                <View
                    style={[
                        styles.versionIcon,
                        { backgroundColor: primary },
                    ]}>
                    <Icon
                        name="arrow-path"
                        size={24}
                        color="#FFFFFF"
                    />
                </View>
                <View style={styles.userInfo}>
                    <ThemeText
                        fontSize="large"
                        fontWeight="bold"
                        color={primary}>
                        v{DeviceInfo.getVersion()}
                    </ThemeText>
                    {updateCheckResult?.needUpdate ? (
                        <ThemeText
                            fontSize="normal"
                            fontWeight="medium"
                            color={primary}>
                            发现新版本 v{updateCheckResult.latestVersion}
                        </ThemeText>
                    ) : updateCheckResult ? (
                        <ThemeText
                            fontSize="normal"
                            fontColor="textSecondary">
                            已是最新版本
                        </ThemeText>
                    ) : (
                        <ThemeText
                            fontSize="normal"
                            fontColor="textSecondary">
                            软件版本
                        </ThemeText>
                    )}
                </View>
            </View>
            <Pressable
                onPress={onCheckUpdate}
                style={[
                    styles.versionBtn,
                    { backgroundColor: primary },
                ]}>
                <ThemeText
                    fontSize="normal"
                    fontWeight="bold"
                    color="#FFFFFF">
                    检查更新
                </ThemeText>
            </Pressable>
            <ThemeText
                fontSize="caption"
                fontColor="textSecondary"
                style={styles.versionCardFooter}>
                正式版 · 更新通道 Gitee
            </ThemeText>
        </LinearGradient>
    ) : null;

    /* ---- MineEntryCard（平板 3 卡行，对齐 APlayer MineEntryCard：全软件统一品牌色渐变，
        "数据与设置"与"我的音乐"同款，不单独用灰调） ---- */
    const renderMineEntryCard = (entry: IEntry) => (
        <Pressable
            key={entry.title}
            style={({ pressed }) => [
                styles.mineCard,
                pressed
                    ? {
                        backgroundColor: Color(primary)
                            .alpha(0.06)
                            .toString(),
                    }
                    : null,
            ]}
            onPress={entry.action}>
            <LinearGradient
                colors={[
                    Color(primary).alpha(0.16).toString(),
                    Color(primary).alpha(0.04).toString(),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.mineCardBg,
                    {
                        borderColor: Color(
                            (colors as any).divider ?? "#E2E8F0",
                        )
                            .alpha(0.35)
                            .toString(),
                    },
                ]}>
                <Icon
                    name={entry.icon}
                    size={44}
                    color={Color("#808080").alpha(0.35).toString()}
                    style={styles.watermark}
                />
                <View style={styles.mineCardRow}>
                    <LinearGradient
                        colors={[
                            primary,
                            Color(primary).alpha(0.75).toString(),
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.mineIconBox}>
                        <Icon name={entry.icon} size={42} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.mineTextBlock}>
                        <ThemeText
                            fontSize="large"
                            fontWeight="bold"
                            numberOfLines={1}>
                            {entry.title}
                        </ThemeText>
                        <ThemeText
                            fontSize="subTitle"
                            color={primary}
                            fontWeight="medium"
                            numberOfLines={1}>
                            {entry.value}
                        </ThemeText>
                    </View>
                </View>
            </LinearGradient>
        </Pressable>
    );

    /* ---- MineStatCard（手机 3 卡行，渐变 0.16→0.04 + 圆角 18，与平板 3 卡同规范） ---- */
    const renderMineStatCard = (entry: IEntry) => (
        <Pressable
            key={entry.title}
            style={({ pressed }) => [
                styles.statCard,
                pressed
                    ? {
                        backgroundColor: Color(primary)
                            .alpha(0.06)
                            .toString(),
                    }
                    : null,
            ]}
            onPress={entry.action}>
            <LinearGradient
                colors={[
                    Color(primary).alpha(0.16).toString(),
                    Color(primary).alpha(0.04).toString(),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.statCardBg,
                    {
                        borderColor: Color(
                            (colors as any).divider ?? "#E2E8F0",
                        )
                            .alpha(0.35)
                            .toString(),
                    },
                ]}>
                <View
                    style={[
                        styles.statIconBox,
                        { backgroundColor: Color(primary).alpha(0.12).toString() },
                    ]}>
                    <Icon name={entry.icon} size={17} color={primary} />
                </View>
                <ThemeText
                    fontSize="normal"
                    fontWeight="bold"
                    numberOfLines={1}
                    style={styles.statTitle}>
                    {entry.title}
                </ThemeText>
                <ThemeText
                    fontSize="caption"
                    color={primary}
                    fontWeight="medium"
                    numberOfLines={1}>
                    {entry.value}
                </ThemeText>
            </LinearGradient>
        </Pressable>
    );

    /* ---- MineEntryItem（手机竖排列表项） ---- */
    const renderMineEntryItem = (entry: IEntry, index: number) => (
        <Pressable
            key={entry.title}
            style={({ pressed }) => [
                styles.entryItem,
                index < entryItems.length - 1
                    ? {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.divider,
                    }
                    : null,
                pressed
                    ? {
                        backgroundColor: Color(primary)
                            .alpha(0.06)
                            .toString(),
                    }
                    : null,
            ]}
            onPress={entry.action}>
            <Icon name={entry.icon} size={20} color={primary} />
            <ThemeText
                fontSize="body"
                fontWeight="medium"
                style={styles.entryItemText}>
                {entry.title}
            </ThemeText>
        </Pressable>
    );

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}>
            <View style={styles.cardRow}>
                {userCard}
                {versionCard}
            </View>

            {isTablet ? (
                <>
                    <ThemeText fontSize="content" fontWeight="bold" style={styles.sectionTitle}>
                        我的音乐
                    </ThemeText>
                    <View style={styles.entryRow}>
                        {mineCards.map(entry =>
                            renderMineEntryCard(entry),
                        )}
                    </View>
                    <ThemeText
                        fontSize="content"
                        fontWeight="bold"
                        style={[styles.sectionTitle, styles.sectionTitleGap]}>
                        数据与设置
                    </ThemeText>
                    <View style={styles.entryRow}>
                        {toolCards.map(entry =>
                            renderMineEntryCard(entry),
                        )}
                    </View>
                </>
            ) : (
                <>
                    <View style={styles.statRow}>
                        {statCards.map(renderMineStatCard)}
                    </View>
                    <ThemeText fontSize="content" fontWeight="bold" style={styles.sectionTitle}>
                        我的音乐
                    </ThemeText>
                    <View
                        style={[
                            styles.entryListCard,
                            { backgroundColor: colors.card },
                        ]}>
                        {entryItems.map(renderMineEntryItem)}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    cardRow: {
        flexDirection: "row",
        columnGap: 10,
        marginBottom: 20,
    },
    /* 用户卡 */
    userCard: {
        flex: 1,
        flexDirection: "column", // 2 卡纵横比方案：竖长方（宽:高 ≈ 1:1.2）
        justifyContent: "space-between",
        padding: 20,
        minHeight: 140,
        borderRadius: 20, // 2 卡圆角 20（卡越大圆角越大）
        borderWidth: 0.5, // 椒盐细边框（outline α0.35，颜色动态随主题）
    },
    userCardTop: {
        flexDirection: "row",
        alignItems: "center",
    },
    userCardBottom: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
    },
    userCardBottomText: {
        flex: 1,
        marginRight: 12,
    },
    versionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    userStatsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 16,
    },
    userStatItem: {
        alignItems: "center",
        flex: 1,
        gap: 2,
    },
    versionBtn: {
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 28,
        alignItems: "center",
        // 不占满卡片全宽：靠右下角的胶囊按钮
        alignSelf: "flex-end",
    },
    versionCardFooter: {
        marginTop: 10,
        alignSelf: "flex-end",
    },
    settingGear: {
        // 流内布局放行尾（不再 absolute 悬浮，避免盖住标题/副标题文字）
        marginLeft: 8,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    userInfo: {
        flex: 1,
    },
    updateChip: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    versionIcon: {
        width: 56,
        height: 56,
        // 与左卡"极"字头像同款圆形，两卡顶部对称
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    /* 分组标题 */
    sectionTitle: {
        marginBottom: 10,
    },
    sectionTitleGap: {
        marginTop: 18,
    },
    /* 平板 MineEntryCard */
    entryRow: {
        flexDirection: "row",
        columnGap: 10,
    },
    mineCard: {
        flex: 1,
        borderRadius: 18,
        overflow: "hidden",
    },
    mineCardBg: {
        borderRadius: 18,
        minHeight: 112, // 3 卡纵横比方案：平板 112（近方 ≈1.35:1）
        paddingVertical: 14,
        paddingHorizontal: 12,
        justifyContent: "center",
        borderWidth: 0.5, // 椒盐细边框（outline α0.35，颜色动态随主题）
    },
    mineCardRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    mineIconBox: {
        width: 46,
        height: 46,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    mineTextBlock: {
        flex: 1,
    },
    watermark: {
        position: "absolute",
        right: 8,
        bottom: 6,
    },
    /* 手机 MineStatCard */
    statRow: {
        flexDirection: "row",
        columnGap: 10,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        overflow: "hidden",
        borderRadius: 18,
    },
    statCardBg: {
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 6,
        minHeight: 104, // 3 卡纵横比方案：手机 104（近方 ≈1.35:1）
        justifyContent: "center",
        borderRadius: 18,
        borderWidth: 0.5, // 椒盐细边框（outline α0.35，颜色动态随主题）
    },
    statIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    statTitle: {
        marginBottom: 3,
        textAlign: "center",
    },
    /* 手机 MineEntryItem */
    entryListCard: {
        borderRadius: 12,
        overflow: "hidden",
        elevation: 1,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
    },
    entryItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    entryItemText: {
        flex: 1,
        marginLeft: 12,
    },
});
