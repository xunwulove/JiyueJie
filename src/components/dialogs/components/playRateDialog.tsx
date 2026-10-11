import React, { useMemo } from "react";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ListItem from "@/components/base/listItem";
import { iconSizeConst } from "@/constants/uiConst";
import ThemeText from "@/components/base/themeText";
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
            <Dialog.Content needScroll style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
                {RATES.map(rate => (
                    <ListItem
                        key={rate.value}
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
                ))}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}
