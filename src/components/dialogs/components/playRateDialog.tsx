import React, { useMemo } from "react";
import { View } from "react-native";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import PersistStatus from "@/utils/persistStatus";
import TrackPlayer from "@/core/trackPlayer";
/**
 * 倍速三级浮窗（全屏功能区"倍速"按钮）：
 * 速率单选 0.5x~2.0x，写入 PersistStatus music.rate（百分比）并应用 TrackPlayer.setRate
 */
const RATES = [
    { label: "0.5x", value: 50 },
    { label: "0.75x", value: 75 },
    { label: "1.0x", value: 100 },
    { label: "1.25x", value: 125 },
    { label: "1.5x", value: 150 },
    { label: "2.0x", value: 200 },
] as const;
export default function PlayRateDialog() {
    const { t } = useI18N();
    const colors = useColors();
    const currentRate = useMemo(
        () => PersistStatus.get("music.rate") ?? 100,
        [],
    );
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{t("panel.playRate.title")}</Dialog.Title>
            <Dialog.Content needScroll style={{ paddingHorizontal: 0, paddingTop: 12, paddingBottom: 12 }}>
                {RATES.map((rate, i) => (
                    <View key={rate.value}>
                        <ListItem
                            withHorizontalPadding
                            heightType="small"
                            onPress={() => {
                                PersistStatus.set("music.rate", rate.value);
                                TrackPlayer.setRate(rate.value / 100);
                                hideDialog();
                            }}>
                            <ListItem.Content title={rate.label} />
                            {currentRate === rate.value ? (
                                <ListItem.ListItemIcon
                                    icon="check"
                                    iconSize={iconSizeConst.light}
                                    color={colors.primary}
                                />
                            ) : null}
                        </ListItem>
                        {/* 2026-10-21 统一：列表项之间加 ListDivider */}
                        {i < RATES.length - 1 ? (
                            <ListDivider marginLeft={16} />
                        ) : null}
                    </View>
                ))}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.done"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}
