import ColorBlock from "@/components/base/colorBlock";
import Icon from "@/components/base/icon.tsx";
import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { SortType } from "@/constants/commonConst.ts";
import Config, { useAppConfig } from "@/core/appConfig";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import LyricUtil, { NativeTextAlignment } from "@/native/lyricUtil";
import NativeUtils from "@/native/utils";
import { AppConfigPropertyKey } from "@/types/core/config";
import { clearCache, getCacheSize, sizeFormatter } from "@/utils/fileUtils";
import { qualityKeys } from "@/utils/qualities";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import Slider from "@react-native-community/slider";
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

export function createSwitch(
    title: string,
    changeKey: AppConfigPropertyKey,
    value: boolean,
    callback?: (newValue: boolean) => void,
) {
    const onPress = () => {
        if (callback) {
            callback(!value);
        } else {
            Config.setConfig(changeKey, !value);
        }
    };
    return {
        title,
        onPress,
        right: <ThemeSwitch value={value} onValueChange={onPress} />,
    };
}

export const createRadio = function (
    title: string,
    changeKey: AppConfigPropertyKey,
    candidates: Array<string | number>,
    value: string | number,
    valueMap?: Record<string | number, string | number>,
    onChange?: (value: string | number) => void,
) {
    const onPress = () => {
        showDialog("RadioDialog", {
            title,
            content: valueMap
                ? candidates.map(_ => ({
                    label: valueMap[_] as string,
                    value: _,
                }))
                : candidates,
            onOk(val) {
                Config.setConfig(changeKey, val);
                onChange?.(val);
            },
        });
    };
    return {
        title,
        right: (
            <ThemeText style={styles.centerText}>
                {valueMap ? valueMap[value] : value}
            </ThemeText>
        ),
        onPress,
    };
};

function useCacheSize() {
    const [cacheSize, setCacheSize] = useState({
        music: 0,
        lyric: 0,
        image: 0,
    });
    /* 惰性统计：进入设置页不统计缓存大小（避免挂载即触发原生目录遍历），点击缓存行时才统计 */
    const [queried, setQueried] = useState(false);

    const refreshCacheSize = useCallback(
        async (type?: "music" | "lyric" | "image") => {
            if (type) {
                const size = await getCacheSize(type);
                setCacheSize(prev => ({ ...prev, [type]: size }));
            } else {
                const [musicCache, lyricCache, imageCache] =
                    await Promise.all([
                        getCacheSize("music"),
                        getCacheSize("lyric"),
                        getCacheSize("image"),
                    ]);
                setCacheSize({
                    music: musicCache,
                    lyric: lyricCache,
                    image: imageCache,
                });
            }
            setQueried(true);
        },
        [],
    );

    return [cacheSize, refreshCacheSize, queried] as const;
}

export default function BasicSetting() {

    const autoPlayWhenAppStart = useAppConfig("basic.autoPlayWhenAppStart");
    const useCelluarNetworkPlay = useAppConfig("basic.useCelluarNetworkPlay");
    const useCelluarNetworkDownload = useAppConfig("basic.useCelluarNetworkDownload");
    const clickMusicInSearch = useAppConfig("basic.clickMusicInSearch");
    const clickMusicInAlbum = useAppConfig("basic.clickMusicInAlbum");
    const notInterrupt = useAppConfig("basic.notInterrupt");
    const tempRemoteDuck = useAppConfig("basic.tempRemoteDuck");
    const tempRemoteDuckVolume = useAppConfig("basic.tempRemoteDuckVolume");
    const autoStopWhenError = useAppConfig("basic.autoStopWhenError");
    const maxCacheSize = useAppConfig("basic.maxCacheSize");
    const defaultPlayQuality = useAppConfig("basic.defaultPlayQuality");
    const playQualityOrder = useAppConfig("basic.playQualityOrder");
    const musicDetailDefault = useAppConfig("basic.musicDetailDefault");
    const musicDetailAwake = useAppConfig("basic.musicDetailAwake");
    const maxHistoryLen = useAppConfig("basic.maxHistoryLen");
    const showExitOnNotification = useAppConfig("basic.showExitOnNotification");
    const musicOrderInLocalSheet = useAppConfig("basic.musicOrderInLocalSheet");
    const tryChangeSourceWhenPlayFail = useAppConfig("basic.tryChangeSourceWhenPlayFail");
    const autoBoot = useAppConfig("basic.autoBoot");

    const { t } = useI18N();

    const navigate = useNavigate();
    const colors = useColors();

    const [cacheSize, refreshCacheSize, cacheQueried] = useCacheSize();

    // ===== 播放 =====
    const playbackGroup = {
        title: t("basicSettings.playback"),
        items: [
            createRadio(
                t("basicSettings.defaultPlayQuality"),
                "basic.defaultPlayQuality",
                qualityKeys,
                defaultPlayQuality ?? "standard",
                {
                    low: t("musicQuality.low"),
                    standard: t("musicQuality.standard"),
                    high: t("musicQuality.high"),
                    super: t("musicQuality.super"),
                },
            ),
            createRadio(
                t("basicSettings.playQualityOrder"),
                "basic.playQualityOrder",
                ["asc", "desc"],
                playQualityOrder ?? "asc",
                {
                    asc: t("basicSettings.playQualityOrder.asc"),
                    desc: t("basicSettings.playQualityOrder.desc"),
                },
            ),
            createSwitch(
                t("basicSettings.autoPlayWhenAppStart"),
                "basic.autoPlayWhenAppStart",
                autoPlayWhenAppStart ?? false,
            ),
            createSwitch(
                t("basicSettings.tryChangeSourceWhenPlayFail"),
                "basic.tryChangeSourceWhenPlayFail",
                tryChangeSourceWhenPlayFail ?? true,
            ),
            createSwitch(
                t("basicSettings.autoStopWhenError"),
                "basic.autoStopWhenError",
                autoStopWhenError ?? false,
            ),
            createSwitch(
                t("basicSettings.notInterrupt"),
                "basic.notInterrupt",
                notInterrupt ?? true,
            ),
            createRadio(
                t("basicSettings.tempRemoteDuck"),
                "basic.tempRemoteDuck",
                ["pause", "lowerVolume"],
                tempRemoteDuck ?? "lowerVolume",
                {
                    pause: t("basicSettings.tempRemoteDuck.pause"),
                    "lowerVolume": t("basicSettings.tempRemoteDuck.lowerVolume"),
                }
            ),
            ...((tempRemoteDuck ?? "lowerVolume") === "lowerVolume" ? [
                createRadio(
                    t("basicSettings.tempRemoteDuck.volumeDecreaseLevel"),
                    "basic.tempRemoteDuckVolume",
                    [0.3, 0.5, 0.8],
                    tempRemoteDuckVolume ?? 0.5,
                    {
                        0.3: "30%",
                        0.5: "50%",
                        0.8: "80%",
                    }
                ),
            ] : []),
        ],
    };

    // ===== 网络与缓存 =====
    const networkGroup = {
        title: t("basicSettings.networkAndCache"),
        items: [
            createSwitch(
                t("basicSettings.useCelluarNetworkPlay"),
                "basic.useCelluarNetworkPlay",
                useCelluarNetworkPlay ?? true,
            ),
            createSwitch(
                t("basicSettings.useCelluarNetworkDownload"),
                "basic.useCelluarNetworkDownload",
                useCelluarNetworkDownload ?? true,
            ),
            {
                title: t("basicSettings.cache.musicCacheLimit"),
                right: (
                    <ThemeText style={styles.centerText}>
                        {maxCacheSize
                            ? sizeFormatter(maxCacheSize)
                            : "512M"}
                    </ThemeText>
                ),
                onPress() {
                    showPanel("SimpleInput", {
                        title: t("dialog.setCacheTitle"),
                        placeholder: t("dialog.setCachePlaceholder"),
                        onOk(text, closePanel) {
                            let val = parseInt(text);
                            if (val < 100) {
                                val = 100;
                            } else if (val > 8192) {
                                val = 8192;
                            }
                            if (val >= 100 && val <= 8192) {
                                Config.setConfig(
                                    "basic.maxCacheSize",
                                    val * 1024 * 1024,
                                );
                                closePanel();
                                Toast.success(t("toast.cacheSetSuccess"));
                            }
                        },
                    });
                },
            },
            {
                title: t("basicSettings.cache.clearMusicCache"),
                right: (
                    <ThemeText style={styles.centerText}>
                        {cacheQueried
                            ? sizeFormatter(cacheSize.music)
                            : "--"}
                    </ThemeText>
                ),
                onPress() {
                    // 惰性统计：点击时才统计当前大小（只遍历音乐缓存目录）
                    refreshCacheSize("music");
                    showDialog("SimpleDialog", {
                        title: t("dialog.clearMusicCacheTitle"),
                        content: t("dialog.clearMusicCacheContent"),
                        async onOk() {
                            await clearCache("music");
                            Toast.success(t("toast.musicCacheCleared"));
                            refreshCacheSize("music");
                        },
                    });
                },
            },
            {
                title: t("basicSettings.cache.clearLyricCache"),
                right: (
                    <ThemeText style={styles.centerText}>
                        {cacheQueried
                            ? sizeFormatter(cacheSize.lyric)
                            : "--"}
                    </ThemeText>
                ),
                onPress() {
                    refreshCacheSize("lyric");
                    showDialog("SimpleDialog", {
                        title: t("dialog.clearLyricCacheTitle"),
                        content: t("dialog.clearLyricCacheContent"),
                        async onOk() {
                            await clearCache("lyric");
                            Toast.success(t("toast.lyricCacheCleared"));
                            refreshCacheSize("lyric");
                        },
                    });
                },
            },
            {
                title: t("basicSettings.cache.clearImageCache"),
                right: (
                    <ThemeText style={styles.centerText}>
                        {cacheQueried
                            ? sizeFormatter(cacheSize.image)
                            : "--"}
                    </ThemeText>
                ),
                onPress() {
                    refreshCacheSize("image");
                    showDialog("SimpleDialog", {
                        title: t("dialog.clearImageCacheTitle"),
                        content: t("dialog.clearImageCacheContent"),
                        async onOk() {
                            await clearCache("image");
                            Toast.success(t("toast.imageCacheCleared"));
                            refreshCacheSize("image");
                        },
                    });
                },
            },
        ],
    };

    // ===== 常规（历史/详情/通知） =====
    const commonGroup = {
        title: t("basicSettings.common"),
        items: [
            createRadio(
                t("basicSettings.maxHistoryLength"),
                "basic.maxHistoryLen",
                [20, 50, 100, 200, 500],
                maxHistoryLen ?? 50,
            ),
            createRadio(
                t("basicSettings.musicDetailDefault"),
                "basic.musicDetailDefault",
                ["album", "lyric"],
                musicDetailDefault ?? "album",
                {
                    album: t("basicSettings.musicDetailDefault.album"),
                    lyric: t("basicSettings.musicDetailDefault.lyric"),
                },
            ),
            createSwitch(
                t("basicSettings.musicDetailAwake"),
                "basic.musicDetailAwake",
                musicDetailAwake ?? false,
            ),
            createSwitch(
                t("basicSettings.showExitOnNotification"),
                "basic.showExitOnNotification",
                showExitOnNotification ?? false,
            ),
            // 开机自启动（车机/平板常电场景）：同步写原生标记供 BootReceiver 开机读取
            createSwitch(
                "开机自启动",
                "basic.autoBoot",
                autoBoot ?? NativeUtils.isAutoBootEnabled(),
                v => {
                    Config.setConfig("basic.autoBoot", v);
                    NativeUtils.setAutoBootEnabled(v);
                },
            ),
        ],
    };

    // ===== 歌单与专辑（点击行为 + 歌单排序） =====
    const sheetGroup = {
        title: t("basicSettings.sheetAndAlbum"),
        items: [
            createRadio(
                t("basicSettings.clickMusicInSearch"),
                "basic.clickMusicInSearch",
                ["playMusic", "playMusicAndReplace"],
                clickMusicInSearch ?? "playMusic",
                {
                    playMusic: t("basicSettings.clickMusicInSearch.playMusic"),
                    playMusicAndReplace: t("basicSettings.clickMusicInSearch.playMusicAndReplace"),
                },
            ),
            createRadio(
                t("basicSettings.clickMusicInAlbum"),
                "basic.clickMusicInAlbum",
                ["playMusic", "playAlbum"],
                clickMusicInAlbum ?? "playAlbum",
                {
                    playMusic: t("basicSettings.clickMusicInAlbum.playMusic"),
                    playAlbum: t("basicSettings.clickMusicInAlbum.playAlbum"),
                },
            ),
            createRadio(
                t("basicSettings.musicOrderInLocalSheet"),
                "basic.musicOrderInLocalSheet",
                [
                    SortType.Title,
                    SortType.Artist,
                    SortType.Album,
                    SortType.Newest,
                    SortType.Oldest,
                ],
                musicOrderInLocalSheet ?? "end",
                {
                    [SortType.Title]: t("basicSettings.musicOrderInLocalSheet.title"),
                    [SortType.Artist]: t("basicSettings.musicOrderInLocalSheet.artist"),
                    [SortType.Album]: t("basicSettings.musicOrderInLocalSheet.album"),
                    [SortType.Newest]: t("basicSettings.musicOrderInLocalSheet.newest"),
                    [SortType.Oldest]: t("basicSettings.musicOrderInLocalSheet.oldest"),
                },
            ),
        ],
    };

    // ===== 更多（入口组：仅保留主题/权限/关于；备份/音源管理等已迁出为独立二级页，不留入口） =====
    const moreGroup = {
        title: t("basicSettings.other"),
        items: [
            {
                title: t("soundEffect.title"),
                right: <Icon name="skip-right" size={20} color={colors.textSecondary ?? "rgba(0,0,0,0.45)"} />,
                onPress() {
                    navigate(ROUTE_PATH.SOUND_EFFECT);
                },
            },
            {
                title: t("sidebar.themeSettings"),
                right: <Icon name="skip-right" size={20} color={colors.textSecondary ?? "rgba(0,0,0,0.45)"} />,
                onPress() {
                    // B3：主题设置改为三级浮窗（不再叠二级设置覆盖层；自定义取色已去除）
                    showDialog("ThemeSettingDialog");
                },
            },
            {
                title: t("permissionSetting.title"),
                right: <Icon name="skip-right" size={20} color={colors.textSecondary ?? "rgba(0,0,0,0.45)"} />,
                onPress() {
                    showDialog("PermissionSettingDialog");
                },
            },
            {
                title: t("common.about"),
                right: <Icon name="skip-right" size={20} color={colors.textSecondary ?? "rgba(0,0,0,0.45)"} />,
                onPress() {
                    navigate(ROUTE_PATH.SETTING, { type: "about" });
                },
            },
        ],
    };

    // ===== 悬浮歌词（独立分组：开关/间距/宽度/字号/对齐/颜色；全屏页浮窗仅保留偏移+关联+自动搜索） =====
    const lyricGroup = {
        title: t("basicSettings.floatLyric"),
        items: [],
        footer: <LyricSetting />,
    };

    const groups: Array<{
        title: string;
        items: Array<{
            title: string;
            onPress?: () => void;
            right?: React.ReactNode;
        }>;
        footer?: React.ReactNode;
    }> = [
        playbackGroup,
        networkGroup,
        commonGroup,
        sheetGroup,
        lyricGroup,
        moreGroup,
    ];

    return (
        <View style={styles.wrapper}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {groups.map((group, gi) => {
                    return (
                        <View key={gi} style={styles.group}>
                            <View
                                style={[
                                    styles.groupHeader,
                                    // 仅第一个分组标题离顶部 AppBar 收紧，其余保持统一间距
                                    gi === 0 ? styles.firstGroupHeader : null,
                                ]}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontColor="primary"
                                    fontWeight="bold">
                                    {group.title}
                                </ThemeText>
                            </View>
                            <View
                                style={[
                                    styles.card,
                                    { backgroundColor: colors.card },
                                ]}>
                                {group.footer}
                                {group.items.map((item, ii) => (
                                    <View key={ii}>
                                        <ListItem
                                            withHorizontalPadding
                                            heightType="small"
                                            onPress={item.onPress}>
                                            <ListItem.Content title={item.title} />
                                            {item.right}
                                        </ListItem>
                                        {ii < group.items.length - 1 ? (
                                            <ListDivider marginLeft={16} />
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        paddingBottom: rpx(24),
        flex: 1,
    },
    scrollContent: {
        paddingBottom: rpx(32),
    },
    centerText: {
        textAlignVertical: "center",
        maxWidth: rpx(400),
    },
    group: {
        marginTop: rpx(8),
    },
    groupHeader: {
        paddingHorizontal: 16,
        height: 36,
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(8),
    },
    /* 仅第一个分组：标题离顶部 AppBar 收紧（其余分组保持统一间距） */
    firstGroupHeader: {
        marginTop: 0,
    },
    card: {
        marginHorizontal: rpx(24),
        borderRadius: 14,
        overflow: "hidden",
    },
});

function LyricSetting() {
    const showStatusBarLyric = useAppConfig("lyric.showStatusBarLyric");
    const topPercent = useAppConfig("lyric.topPercent");
    const leftPercent = useAppConfig("lyric.leftPercent");
    const align = useAppConfig("lyric.align");
    const color = useAppConfig("lyric.color");
    const backgroundColor = useAppConfig("lyric.backgroundColor");
    const widthPercent = useAppConfig("lyric.widthPercent");
    const fontSize = useAppConfig("lyric.fontSize");

    const colors = useColors();

    const { t } = useI18N();

    const openStatusBarLyric = createSwitch(
        t("basicSettings.lyric.showStatusBarLyric"),
        "lyric.showStatusBarLyric",
        showStatusBarLyric ?? false,
        async newValue => {
            try {
                if (newValue) {
                    const hasPermission =
                        await LyricUtil.checkSystemAlertPermission();

                    if (hasPermission) {
                        const statusBarLyricConfig = {
                            topPercent: Config.getConfig("lyric.topPercent"),
                            leftPercent: Config.getConfig("lyric.leftPercent"),
                            align: Config.getConfig("lyric.align"),
                            color: Config.getConfig("lyric.color"),
                            backgroundColor: Config.getConfig("lyric.backgroundColor"),
                            widthPercent: Config.getConfig("lyric.widthPercent"),
                            fontSize: Config.getConfig("lyric.fontSize"),
                        };
                        LyricUtil.showStatusBarLyric(
                            "极悦界",
                            statusBarLyricConfig ?? {}
                        );
                        Config.setConfig("lyric.showStatusBarLyric", true);
                    } else {
                        LyricUtil.requestSystemAlertPermission()
                            .catch(() => {})
                            .finally(() => {
                                Toast.warn(t("toast.noFloatWindowPermission"));
                            });
                    }
                } else {
                    LyricUtil.hideStatusBarLyric().catch(() => {});
                    Config.setConfig("lyric.showStatusBarLyric", false);
                }
            } catch { }
        },
    );

    const alignStatusBarLyric = createRadio(
        t("basicSettings.lyric.align"),
        "lyric.align",
        [
            NativeTextAlignment.LEFT,
            NativeTextAlignment.CENTER,
            NativeTextAlignment.RIGHT,
        ],
        align ?? NativeTextAlignment.CENTER,
        {
            [NativeTextAlignment.LEFT]: t("basicSettings.lyric.align.left"),
            [NativeTextAlignment.CENTER]: t("basicSettings.lyric.align.center"),
            [NativeTextAlignment.RIGHT]: t("basicSettings.lyric.align.right"),
        },
        newVal => {
            if (showStatusBarLyric) {
                LyricUtil.setStatusBarLyricAlign(newVal as any).catch(() => {});
            }
        },
    );

    return (
        <View>
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={openStatusBarLyric.onPress}>
                <ListItem.Content title={openStatusBarLyric.title} />
                {openStatusBarLyric.right}
            </ListItem>
            <View style={lyricStyles.sliderRow}>
                <View style={lyricStyles.sliderLabelRow}>
                    <ThemeText fontSize="content" fontWeight="medium">
                        {t("basicSettings.lyric.leftRightDistance")}
                    </ThemeText>
                    <ThemeText fontSize="content" fontColor="textSecondary">
                        {Math.round((leftPercent ?? 0.5) * 100)}%
                    </ThemeText>
                </View>
                <Slider
                    style={lyricStyles.slider}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.text ?? "#999999"}
                    thumbTintColor={colors.primary}
                    minimumValue={0}
                    step={0.01}
                    value={leftPercent ?? 0.5}
                    maximumValue={1}
                    onValueChange={val => {
                        if (showStatusBarLyric) {
                            LyricUtil.setStatusBarLyricLeft(val).catch(() => {});
                        }
                    }}
                    onSlidingComplete={val => {
                        Config.setConfig("lyric.leftPercent", val);
                    }}
                />
            </View>
            <View style={lyricStyles.sliderRow}>
                <View style={lyricStyles.sliderLabelRow}>
                    <ThemeText fontSize="content" fontWeight="medium">
                        {t("basicSettings.lyric.topBottomDistance")}
                    </ThemeText>
                    <ThemeText fontSize="content" fontColor="textSecondary">
                        {Math.round((topPercent ?? 0) * 100)}%
                    </ThemeText>
                </View>
                <Slider
                    style={lyricStyles.slider}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.text ?? "#999999"}
                    thumbTintColor={colors.primary}
                    minimumValue={0}
                    value={topPercent ?? 0}
                    step={0.01}
                    maximumValue={1}
                    onValueChange={val => {
                        if (showStatusBarLyric) {
                            LyricUtil.setStatusBarLyricTop(val).catch(() => {});
                        }
                    }}
                    onSlidingComplete={val => {
                        Config.setConfig("lyric.topPercent", val);
                    }}
                />
            </View>
            <View style={lyricStyles.sliderRow}>
                <View style={lyricStyles.sliderLabelRow}>
                    <ThemeText fontSize="content" fontWeight="medium">
                        {t("basicSettings.lyric.width")}
                    </ThemeText>
                    <ThemeText fontSize="content" fontColor="textSecondary">
                        {Math.round((widthPercent ?? 0.5) * 100)}%
                    </ThemeText>
                </View>
                <Slider
                    style={lyricStyles.slider}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.text ?? "#999999"}
                    thumbTintColor={colors.primary}
                    minimumValue={0}
                    step={0.01}
                    value={widthPercent ?? 0.5}
                    maximumValue={1}
                    onValueChange={val => {
                        if (showStatusBarLyric) {
                            LyricUtil.setStatusBarLyricWidth(val).catch(() => {});
                        }
                    }}
                    onSlidingComplete={val => {
                        Config.setConfig("lyric.widthPercent", val);
                    }}
                />
            </View>
            <View style={lyricStyles.sliderRow}>
                <View style={lyricStyles.sliderLabelRow}>
                    <ThemeText fontSize="content" fontWeight="medium">
                        {t("basicSettings.lyric.fontSize")}
                    </ThemeText>
                    <ThemeText fontSize="content" fontColor="textSecondary">
                        {Math.round(fontSize ?? 20)}
                    </ThemeText>
                </View>
                <Slider
                    style={lyricStyles.slider}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.text ?? "#999999"}
                    thumbTintColor={colors.primary}
                    minimumValue={14}
                    step={0.5}
                    maximumValue={48}
                    value={fontSize ?? 20}
                    onValueChange={val => {
                        if (showStatusBarLyric) {
                            LyricUtil.setStatusBarLyricFontSize(val).catch(
                                () => {},
                            );
                        }
                    }}
                    onSlidingComplete={val => {
                        Config.setConfig("lyric.fontSize", val);
                    }}
                />
            </View>
            <ListDivider marginLeft={16} />
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={alignStatusBarLyric.onPress}>
                <ListItem.Content title={alignStatusBarLyric.title} />
                {alignStatusBarLyric.right}
            </ListItem>
            <ListDivider marginLeft={16} />
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={() => {
                    showDialog("LyricColorDialog", {
                        title: t("basicSettings.lyric.textColor"),
                        defaultColor: color ?? "#FFE9D2FF",
                        onSelected(color) {
                            const colorStr = color.hexa();
                            Config.setConfig("lyric.color", colorStr);
                            if (showStatusBarLyric) {
                                LyricUtil.setStatusBarColors(
                                    colorStr,
                                    null,
                                ).catch(() => {});
                            }
                        },
                    });
                }}>
                <ListItem.Content title={t("basicSettings.lyric.textColor")} />
                <ColorBlock color={color ?? "#FFE9D2FF"} />
            </ListItem>
            <ListDivider marginLeft={16} />
            <ListItem
                withHorizontalPadding
                heightType="small"
                onPress={() => {
                    showDialog("LyricColorDialog", {
                        title: t("basicSettings.lyric.backgroundColor"),
                        defaultColor: backgroundColor ?? "#84888153",
                        onSelected(color) {
                            const colorStr = color.hexa();
                            Config.setConfig(
                                "lyric.backgroundColor",
                                colorStr,
                            );
                            if (showStatusBarLyric) {
                                LyricUtil.setStatusBarColors(
                                    null,
                                    colorStr,
                                ).catch(() => {});
                            }
                        },
                    });
                }}>
                <ListItem.Content title={t("basicSettings.lyric.backgroundColor")} />
                <ColorBlock
                    color={backgroundColor ?? "#84888153"}
                />
            </ListItem>
        </View>
    );
}

const lyricStyles = StyleSheet.create({
    // 与主题设置 backgroundCustom 滑块行写法统一：标签行（左标签 medium / 右数值 textSecondary）在上、滑块在下
    sliderRow: {
        marginTop: rpx(28),
    },
    sliderLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: rpx(8),
    },
    slider: {
        width: "100%",
        height: rpx(36),
    },
});
