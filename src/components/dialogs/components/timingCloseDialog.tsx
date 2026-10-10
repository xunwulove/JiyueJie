import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";

import { setCloseAfterPlayEnd, setScheduleClose, useCloseAfterPlayEnd, useScheduleCloseCountDown } from "@/utils/scheduleClose";
import timeformat from "@/utils/timeformat";
import Divider from "@/components/base/divider";
import Checkbox from "@/components/base/checkbox";
import { Pressable } from "react-native-gesture-handler";
import { useI18N } from "@/core/i18n";
import { showDialog } from "../useDialog";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";

const shortCutTimes = [10, 20, 30, 45, 60] as const;

/**
 * 定时关闭三级浮窗（全屏功能区"定时关闭"按钮）：
 * 快捷时长行 + 自定义时长 + 播完自动关闭 + 取消定时（原 TimingClose 面板逻辑迁移为三级浮窗）
 */
export default function TimingCloseDialog() {
    const closeAfterPlay = useCloseAfterPlayEnd();
    const countDown = useScheduleCloseCountDown();
    const { t } = useI18N();

    const isCountingDown = countDown !== null;

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>
                {countDown === null
                    ? t("sidebar.scheduleClose")
                    : t("panel.timingClose.countdown", { time: timeformat(countDown) })}
            </Dialog.Title>
            <Dialog.Content>
                <View style={styles.bodyContainer}>
                    {shortCutTimes.map((time, index) => (
                        <TouchableOpacity
                            style={styles.timeItem}
                            key={index}
                            activeOpacity={0.6}
                            onPress={() => {
                                setScheduleClose(
                                    Date.now() + time * 60000,
                                );
                                hideDialog();
                            }}>
                            <ThemeText>{time}</ThemeText>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        style={styles.timeItem}
                        key="customize"
                        activeOpacity={0.6}
                        onPress={() => {
                            showDialog("SetScheduleCloseTimeDialog", {
                                onOk: (minutes: number) => {
                                    setScheduleClose(
                                        Date.now() + minutes * 60000,
                                    );
                                    hideDialog();
                                },
                            });
                        }}>
                        <ThemeText>
                            {t("panel.timingClose.customize")}
                        </ThemeText>
                    </TouchableOpacity>
                </View>
                <Divider style={{ marginVertical: rpx(16) }} />
                <View style={styles.bottomLine}>
                    <Pressable
                        style={styles.closeAfterPlayContainer}
                        onPress={() => {
                            setCloseAfterPlayEnd(!closeAfterPlay);
                        }}>
                        <Checkbox checked={closeAfterPlay} />
                        <ThemeText style={styles.bottomLineText}>
                            {t("panel.timingClose.closeAfterPlay")}
                        </ThemeText>
                    </Pressable>
                    {isCountingDown && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                setScheduleClose(null);
                                hideDialog();
                            }}>
                            <ThemeText style={styles.cancelButtonText}>
                                {t("panel.timingClose.cancelScheduleClose")}
                            </ThemeText>
                        </TouchableOpacity>
                    )}
                </View>
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

const styles = StyleSheet.create({
    bodyContainer: {
        width: "100%",
        paddingVertical: rpx(8),
        gap: rpx(16),
        flexDirection: "row",
    },
    timeItem: {
        flex: 1,
        backgroundColor: "#99999999",
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: rpx(16),
    },
    bottomLine: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    cancelButton: {
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(8),
        backgroundColor: "#ff666699",
        borderRadius: rpx(8),
    },
    cancelButtonText: {
        color: "#ffffff",
        fontSize: fontSizeConst.normal,
        fontWeight: fontWeightConst.medium,
    },
    closeAfterPlayContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    bottomLineText: {
        marginLeft: rpx(12),
    },
});
