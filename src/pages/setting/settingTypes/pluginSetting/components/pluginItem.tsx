import React, { memo, useEffect, useState } from "react";

import useColors from "@/hooks/useColors";
import pluginManager, { Plugin, usePluginEnabled } from "@/core/pluginManager";
import { PluginState, PluginErrorReason } from "@/core/pluginManager/plugin";
import pluginReliability from "@/core/pluginReliability";

import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import rpx from "@/utils/rpx";
import {
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

    // 可用率（null = 暂无统计数据）
    const [reliability, setReliability] = useState<number | null>(null);
    useEffect(() => {
        let alive = true;
        pluginReliability
            .getReliabilityRecord(plugin.instance.platform)
            .then(record => {
                if (alive) {
                    if (record && record.success + record.fail > 0) {
                        setReliability(
                            record.success / (record.success + record.fail),
                        );
                    } else {
                        setReliability(null);
                    }
                }
            });
        return () => {
            alive = false;
        };
    }, [plugin]);

    // 可用率标签配色：高(≥80%)绿 / 中(50%~80%)主色 / 低(<50%)红
    const reliabilityColor =
        reliability === null
            ? colors.textSecondary
            : reliability >= 0.8
            ? "#4CAF50"
            : reliability >= 0.5
            ? colors.primary
            : "#E53935";

    const alternativePluginName = pluginManager.getAlternativePluginName(plugin);

    const options: IOption[] = [
        {
            title: t("pluginSetting.pluginItem.options.updatePlugin"),
            icon: "arrow-path",
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
            icon: "share",
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
            icon: "trash-outline",
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
                    <ThemeText
                        numberOfLines={1}
                        fontSize="title">
                        {plugin.name}
                    </ThemeText>
                    {
                        plugin.instance.description?.length ? <IconButton name='question-mark-circle' sizeType='light' onPress={() => {
                            showDialog("MarkdownDialog", {
                                title: plugin.name,
                                markdownContent: plugin.instance.description!,
                            });
                        }} /> : null
                    }
                    {/* 可用率标签（仅在有统计数据时显示，只展示百分比） */}
                    {reliability !== null ? (
                        <View
                            style={[
                                styles.reliabilityTag,
                                { backgroundColor: reliabilityColor },
                            ]}>
                            <Text
                                numberOfLines={1}
                                style={styles.reliabilityText}>
                                {Math.round(reliability * 100)}%
                            </Text>
                        </View>
                    ) : null}
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
                        color="#E53935"
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
    reliabilityTag: {
        borderRadius: rpx(8),
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: rpx(4),
    },
    reliabilityText: {
        fontSize: fontSizeConst.description,
        color: "#FFFFFF",
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
