import React, { memo, useEffect, useState } from "react";

import useColors from "@/hooks/useColors";
import pluginManager, { Plugin, usePluginEnabled } from "@/core/pluginManager";
import { PluginState, PluginErrorReason } from "@/core/pluginManager/plugin";
import pluginReliability, {
    IBestDimension,
} from "@/core/pluginReliability";

import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import { showDialog } from "@/components/dialogs/useDialog";
import rpx from "@/utils/rpx";
import {
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";
import ThemeText from "@/components/base/themeText";
import IconTextButton from "@/components/base/iconTextButton";
import ThemeSwitch from "@/components/base/switch";
import { IIconName } from "@/components/base/icon.tsx";
import { useI18N } from "@/core/i18n";
import IconButton from "@/components/base/iconButton";
import { fontSizeConst } from "@/constants/uiConst";

interface IPluginItemProps {
    plugin: Plugin;
    /** 覆盖容器样式（如平板网格布局时调整间距） */
    style?: StyleProp<ViewStyle>;
}

interface IOption {
    title: string;
    icon: IIconName;
    onPress?: () => void;
    show?: boolean;
}

function _PluginItem(props: IPluginItemProps) {
    const { plugin, style } = props;
    const colors = useColors();
    const enabled = usePluginEnabled(plugin);
    const { t } = useI18N();

    // 展示口径：源能力决定（纯歌词源→歌词、纯歌单源→歌单、完整源→合成）。
    // 徽章与详情弹窗大字共用此口径，避免"最强维度"口径把完整源误标成纯功能源
    const isLyricSource =
        plugin.supportedMethods.has("getLyric") &&
        !plugin.supportedMethods.has("search") &&
        !plugin.supportedMethods.has("getMediaSource");
    const isPureSheetSource =
        plugin.supportedMethods.has("getRecommendSheetTags") &&
        !plugin.supportedMethods.has("search") &&
        !plugin.supportedMethods.has("getMediaSource");
    const displayKind: "lyric" | "sheet" | "synthetic" = isLyricSource
        ? "lyric"
        : isPureSheetSource
            ? "sheet"
            : "synthetic";

    const [best, setBest] = useState<IBestDimension | null>(null);
    useEffect(() => {
        let alive = true;
        const refresh = () => {
            if (!alive) {
                return;
            }
            // 浅比较：type+rate 均未变则不 setState，避免探测期每次广播都触发本卡片重渲染
            setBest(prev => {
                const next = pluginReliability.getDisplayByAbilitySync(
                    plugin.instance.platform,
                    displayKind,
                );
                if (
                    prev &&
                    prev.type === next.type &&
                    prev.rate === next.rate
                ) {
                    return prev;
                }
                return next;
            });
        };
        pluginReliability
            .getReliabilityRecord(plugin.instance.platform)
            .then(() => {
                refresh();
            });
        // 同时等推荐歌单统计加载：避免歌单维度首帧显示错口径且不自纠
        pluginReliability
            .getRecommendReliability(plugin.instance.platform)
            .then(() => {
                refresh();
            });
        // 统计变更实时刷新：播放/搜索/探测写入统计后，卡片可用率标签立即更新，
        // 与详情弹窗（打开时重新拉取）保持一致；按 platform 定向订阅，避免全局广播
        const unsub = pluginReliability.subscribeReliability(
            refresh,
            plugin.instance.platform,
        );
        return () => {
            alive = false;
            unsub();
        };
    }, [plugin]);

    // 可用率标签配色：高(≥80%)绿 / 中(50%~80%)主色 / 低(<50%)红；
    // 无统计数据默认 50%（textSecondary）；歌词/歌单标签用主色底
    const bestRate = best?.rate ?? null;
    const reliabilityColor =
        bestRate === null
            ? colors.textSecondary
            : bestRate >= 0.8
                ? colors.success
                : bestRate >= 0.5
                    ? colors.primary
                    : colors.danger;

    // 标签内容：口径为歌词显示"歌词"、歌单显示"歌单"、合成为可用率百分比（无数据默认 50%）
    const tagText =
        best?.type === "lyric"
            ? "歌词"
            : best?.type === "sheet"
                ? "歌单"
                : bestRate === null
                    ? "50%"
                    : `${Math.round(bestRate * 100)}%`;
    const tagBg =
        best?.type === "lyric" || best?.type === "sheet"
            ? colors.primary
            : reliabilityColor;

    const alternativePluginName = pluginManager.getAlternativePluginName(plugin);

    const options: IOption[] = [
        {
            title: t("pluginSetting.pluginItem.options.updatePlugin"),
            icon: "refresh-cw",
            async onPress() {
                try {
                    await pluginManager.updatePlugin(plugin);
                    Toast.success(t("toast.pluginUpdateSuccess"));
                } catch (e: any) {
                    Toast.warn(e?.message ?? t("toast.failToUpdatePlugin"));
                }
            },
            show: !!plugin.instance.srcUrl,
        },
        {
            title: t("pluginSetting.pluginItem.options.sharePlugin"),
            icon: "share-2",
            async onPress() {
                try {
                    Clipboard.setString(plugin.instance.srcUrl!);
                    Toast.success(t("toast.copiedToClipboard"));
                } catch (e: any) {
                    Toast.warn(e?.message ?? t("toast.failToSharePlugin"));
                }
            },
            show: !!plugin.instance.srcUrl,
        },
        {
            title: t("pluginSetting.pluginItem.options.uninstallPlugin"),
            icon: "trash-2",
            show: true,
            onPress() {
                showDialog("SimpleDialog", {
                    title: t("pluginSetting.pluginItem.options.uninstallPlugin"),
                    content: t("pluginSetting.pluginItem.options.uninstallPluginContent", {
                        name: plugin.name,
                    }),
                    async onOk() {
                        try {
                            await pluginManager.uninstallPlugin(plugin.hash);
                            Toast.success(t("toast.pluginUninstalled"));
                        } catch {
                            Toast.warn(t("toast.failToUpdatePlugin"));
                        }
                    },
                });
            },
        },
    ];

    // 插件异常状态展示：state 进入 Error 或存在 errorReason 时醒目提示
    const isErrorState =
        plugin.state === PluginState.Error || !!plugin.errorReason;
    const canUpdate = !!plugin.instance.srcUrl;
    let errorText: string | null = null;
    if (isErrorState) {
        switch (plugin.errorReason) {
        case PluginErrorReason.CannotParse:
            errorText = "插件已损坏，无法解析";
            break;
        case PluginErrorReason.VersionNotMatch:
            errorText = "插件版本与 App 不兼容";
            break;
        default:
            errorText = "插件异常，请尝试更新";
        }
        if (canUpdate) {
            errorText += "，点击更新/重试";
        }
    }

    return (
        <View
            style={[
                styles.container,
                style,
                {
                    backgroundColor: colors.card,
                },
            ]}>
            <View style={styles.header}>
                <View style={styles.headerPluginContainer}>
                    {/* 插件名字 = 设置入口：有 userVariables 时点击弹设置表单；没有则不可点（disabled） */}
                    <Pressable
                        disabled={!plugin.instance.userVariables?.length}
                        onPress={() =>
                            showDialog("PluginSettingDialog", { plugin })
                        }
                        style={({ pressed }) => [
                            styles.pluginNameTouch,
                            pressed &&
                            plugin.instance.userVariables?.length
                                ? styles.pluginNamePressed
                                : null,
                        ]}>
                        <ThemeText
                            numberOfLines={1}
                            fontSize="title"
                            color={
                                plugin.instance.userVariables?.length
                                    ? colors.primary
                                    : undefined
                            }>
                            {plugin.name}
                        </ThemeText>
                    </Pressable>
                    {
                        plugin.instance.description?.length ? <IconButton name='circle-help' sizeType='light' onPress={() => {
                            showDialog("MarkdownDialog", {
                                title: plugin.name,
                                markdownContent: plugin.instance.description!,
                            });
                        }} /> : null
                    }
                    {/* 可用率/歌词标签：普通源显示可用率（无数据默认 50%）；歌词源显示"歌词"。
                        点击弹出可用率详情弹窗（合成可用率 + 分维度明细 + 推荐歌单 + 最后探测时间） */}
                    <Pressable
                        onPress={() =>
                            showDialog("PluginReliabilityDialog", { plugin })
                        }
                        style={({ pressed }) => [
                            styles.reliabilityTag,
                            { backgroundColor: tagBg },
                            pressed ? styles.reliabilityTagPressed : null,
                        ]}>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.reliabilityText,
                                { color: colors.appBarText },
                            ]}>
                            {tagText}
                        </Text>
                    </Pressable>
                </View>
                <ThemeSwitch
                    value={enabled}
                    onValueChange={val => {
                        pluginManager.setPluginEnabled(plugin, val);
                    }}
                />
            </View>
            <View style={styles.description}>
                <ThemeText fontSize="subTitle" fontColor="textSecondary">
                    {t("pluginSetting.pluginItem.versionHint", {
                        version: plugin.instance.version,
                    })}
                </ThemeText>
                {plugin.instance.author ? (
                    <ThemeText
                        fontSize="subTitle"
                        fontColor="textSecondary"
                        numberOfLines={1}
                        style={styles.author}>
                        {t("pluginSetting.pluginItem.author", {
                            author: plugin.instance.author,
                        })}
                    </ThemeText>
                ) : null}
            </View>
            {alternativePluginName ? <View style={styles.alternativePluginDescription}>
                <ThemeText fontSize="subTitle" fontColor="textSecondary">
                    {t("pluginSetting.pluginItem.alternativePlugin", {
                        name: alternativePluginName,
                    })}
                </ThemeText>
            </View> : null}
            {errorText ? (
                <View style={styles.errorDescription}>
                    <ThemeText
                        fontSize="subTitle"
                        color={colors.danger}
                        style={styles.errorText}>
                        {errorText}
                    </ThemeText>
                </View>
            ) : null}
            <View style={styles.contents}>
                {options.map((it, index) =>
                    it.show !== false ? (
                        <IconTextButton
                            key={index}
                            icon={it.icon}
                            onPress={it.onPress}
                            containerStyle={styles.actionButton}>
                            {it.title}
                        </IconTextButton>
                    ) : null,
                )}
            </View>
        </View>
        // <List.Accordion
        //     theme={{
        //         colors: {
        //             primary: colors.textHighlight,
        //         },
        //     }}
        //     style={{
        //         height: ITEM_HEIGHT_BIG,
        //     }}
        //     titleStyle={[
        //         {
        //             fontSize: fontSizeConst.title,
        //             fontWeight: fontWeightConst.semibold,
        //         },
        //         plugin.state === 'error' ? {color: 'red'} : undefined,
        //     ]}
        //     key={`plg-${plugin.hash}`}
        //     title={`${plugin.name}${
        //         plugin.instance.version ? `(${plugin.instance.version})` : ''
        //     }`}
        //     description={
        //         plugin.stateCode === PluginStateCode.VersionNotMatch
        //             ? '插件和app版本不兼容'
        //             : plugin.stateCode === PluginStateCode.CannotParse
        //             ? '无法解析插件'
        //             : undefined
        //     }>
        //     {options.map(_ =>
        //         _.show ? (
        //             <ListItem
        //                 withHorizontalPadding
        //                 key={`${plugin.hash}${_.title}`}
        //                 onPress={_.onPress}>
        //                 <ListItem.ListItemIcon icon={_.icon} />
        //                 <ListItem.Content title={_.title} />
        //             </ListItem>
        //         ) : null,
        //     )}
        // </List.Accordion>
    );
}

const PluginItem = memo(_PluginItem, (prev, curr) => {
    return prev.plugin === curr.plugin;
});
export default PluginItem;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: 14,
        marginHorizontal: rpx(24),
        paddingVertical: 12,
        marginTop: rpx(20),
    },
    header: {
        paddingHorizontal: rpx(16),
        flexDirection: "row",
        alignItems: "center",
    },
    headerPluginContainer: {
        flexShrink: 1,
        flexGrow: 1,
        flexDirection: "row",
        gap: rpx(8),
        alignItems: "center",
    },
    /** 插件名（设置入口）：可点时轻微压暗提示可点 */
    pluginNameTouch: {
        flexShrink: 1,
    },
    pluginNamePressed: {
        opacity: 0.6,
    },
    reliabilityTag: {
        borderRadius: rpx(8),
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: rpx(4),
    },
    reliabilityTagPressed: {
        opacity: 0.7,
    },
    reliabilityText: {
        fontSize: fontSizeConst.description,
        includeFontPadding: false,
    },
    author: {
        marginLeft: rpx(24),
        flexShrink: 1,
        flexGrow: 1,
    },
    description: {
        marginHorizontal: rpx(16),
        marginVertical: 12,
        flexDirection: "row",
    },
    alternativePluginDescription: {
        marginHorizontal: rpx(16),
        marginBottom: 12,
        flexDirection: "row",
    },
    errorDescription: {
        marginHorizontal: rpx(16),
        marginBottom: 12,
        flexDirection: "row",
    },
    errorText: {
        flexShrink: 1,
        flexGrow: 1,
    },
    contents: {
        flexDirection: "row",
        gap: rpx(8),
        paddingHorizontal: rpx(16),
    },
    /* 操作按钮等分占满一行（防多按钮溢出卡片；三列窄卡收窄内边距） */
    actionButton: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: rpx(4),
    },
});
