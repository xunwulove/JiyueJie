import React, { useMemo, useState } from "react";
import { FlatList } from "react-native-gesture-handler";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import Config from "@/core/appConfig";
import PluginManager from "@/core/pluginManager";
import { getRecommendReliabilitySync } from "@/core/pluginReliability";
import useOrientation from "@/hooks/useOrientation";
import rpx, { vmin, vmax } from "@/utils/rpx";

interface IRecommendSourceDialogProps {
    /** 保存并应用后回调（调用方据此强制刷新推荐歌单） */
    onApplied?: () => void;
}

interface IRow {
    key: string;
    title: string;
    /** 推荐歌单专用可用率（0~1）；null = "自动择优"入口，不显示百分比 */
    reliability: number | null;
}

/** 手动指定"推荐歌单来源"三级浮窗（单选优先 + 择优兜底）：
 * - 数据：自动择优 + 全部具备 getRecommendSheetTags 的已启用插件（按推荐歌单可用率降序）
 * - 交互：点击行切换单选；底部 = 取消 / 确认 / 恢复默认
 * - 确认/恢复默认立即保存并应用（恢复默认 = 清除指定源回自动择优），随后回调调用方强制刷新
 * 配置键：plugin.recommendSource（插件 hash；undefined = 自动择优） */
export default function RecommendSourceDialog(props: IRecommendSourceDialogProps) {
    const { onApplied } = props;
    const { t } = useI18N();
    const colors = useColors();
    const orientation = useOrientation();

    const [selected, setSelected] = useState<string>(() =>
        Config.getConfig("plugin.recommendSource") ?? "auto",
    );

    const rows = useMemo<IRow[]>(() => {
        const plugins = PluginManager.getSortedPluginsWithAbility(
            "getRecommendSheetTags",
        )
            .slice()
            .sort(
                (a, b) =>
                    getRecommendReliabilitySync(b.instance.platform) -
                    getRecommendReliabilitySync(a.instance.platform),
            );
        return [
            {
                key: "auto",
                title: t("recommendSheet.autoSelect"),
                reliability: null,
            },
            ...plugins.map(p => ({
                key: p.hash,
                title: p.name,
                reliability: getRecommendReliabilitySync(
                    p.instance.platform,
                ),
            })),
        ];
    }, [t]);

    /** 应用并关闭：auto=清除指定（回自动择优），hash=锁定该源；随后通知调用方强制刷新 */
    const apply = (next: string) => {
        Config.setConfig(
            "plugin.recommendSource",
            next === "auto" ? undefined : next,
        );
        hideDialog();
        onApplied?.();
    };

    /** 刷新：随机选择一个音源作为歌单（写入配置并持久化，下次进软件一天内仍显示该歌单） */
    const refreshRandom = () => {
        const plugins = PluginManager.getSortedPluginsWithAbility(
            "getRecommendSheetTags",
        );
        if (!plugins.length) {
            hideDialog();
            onApplied?.();
            return;
        }
        const picked =
            plugins[Math.floor(Math.random() * plugins.length)];
        Config.setConfig("plugin.recommendSource", picked.hash);
        hideDialog();
        onApplied?.();
    };

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{t("recommendSheet.sourceSetting")}</Dialog.Title>
            <FlatList
                style={{
                    maxHeight:
                        orientation === "horizontal" ? vmin(60) : vmax(60),
                }}
                data={rows}
                keyExtractor={it => it.key}
                getItemLayout={(_, index) => ({
                    length: ListItem.Size.small,
                    offset: ListItem.Size.small * index,
                    index,
                })}
                renderItem={({ item }) => {
                    const isSelected = item.key === selected;
                    return (
                        <ListItem
                            withHorizontalPadding
                            onPress={() => setSelected(item.key)}
                            heightType="small">
                            <ListItem.Content>
                                <ThemeText
                                    numberOfLines={1}
                                    fontWeight={
                                        isSelected ? "bold" : "medium"
                                    }
                                    color={
                                        isSelected
                                            ? colors.primary
                                            : undefined
                                    }>
                                    {item.title}
                                </ThemeText>
                            </ListItem.Content>
                            {item.reliability !== null ? (
                                <ThemeText
                                    fontSize="caption"
                                    fontColor="textSecondary"
                                    style={styles.reliabilityText}>
                                    {Math.round(item.reliability * 100)}%
                                </ThemeText>
                            ) : null}
                            {isSelected ? (
                                <ListItem.ListItemIcon
                                    icon="check"
                                    iconSize={iconSizeConst.light}
                                    color={colors.primary}
                                />
                            ) : null}
                        </ListItem>
                    );
                }}
            />
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.refresh"),
                        type: "normal",
                        onPress: refreshRandom,
                    },
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                    {
                        title: t("common.confirm"),
                        type: "primary",
                        onPress: () => apply(selected),
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = {
    reliabilityText: {
        marginRight: rpx(16),
    },
};
