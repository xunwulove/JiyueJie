import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";

import Slider from "@react-native-community/slider";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import { hideDialog } from "../useDialog";
import Dialog from "./base";

interface IProps {
    defaultSelect?: number;
    /** 实时回调（拖动滑块即生效） */
    onSelectChange: (value: number) => void;
}

/**
 * 字体大小三级浮窗（全屏三点菜单"字体大小"项）：
 * 原 SetFontSize 面板逻辑迁移为三级浮窗
 */
export default function SetFontSizeDialog(props: IProps) {
    const { defaultSelect, onSelectChange } = props ?? {};
    const colors = useColors();
    const i18n = useI18N();
    const [selected, setSelected] = useState(defaultSelect ?? 1);

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{i18n.t("panel.setFontSize.title")}</Dialog.Title>
            <Dialog.Content>
                <View style={styles.container}>
                    <Slider
                        style={styles.sliderContainer}
                        thumbTintColor={colors.primary}
                        minimumTrackTintColor={colors.primary}
                        value={selected}
                        step={1}
                        onValueChange={val => {
                            setSelected(val);
                            onSelectChange?.(val);
                        }}
                        minimumValue={0}
                        maximumValue={3}
                    />
                    <ThemeText style={styles.label}>
                        {i18n.t("panel.setFontSize.small")}
                    </ThemeText>
                    <ThemeText style={[styles.label, styles.label1]}>
                        {i18n.t("panel.setFontSize.standard")}
                    </ThemeText>
                    <ThemeText style={[styles.label, styles.label2]}>
                        {i18n.t("panel.setFontSize.large")}
                    </ThemeText>
                    <ThemeText style={[styles.label, styles.label3]}>
                        {i18n.t("panel.setFontSize.extraLarge")}
                    </ThemeText>
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: i18n.t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: rpx(24),
        width: "100%",
        marginTop: rpx(16),
        height: rpx(200),
    },
    sliderContainer: {
        height: rpx(80),
    },
    label: {
        position: "absolute",
        top: rpx(88),
        width: rpx(72),
        textAlign: "center",
        left: rpx(24),
        opacity: 0.5,
    },
    label1: {
        left: rpx(234),
    },
    label2: {
        left: rpx(442),
    },
    label3: {
        left: rpx(646),
    },
});
