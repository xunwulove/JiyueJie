import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";

import { setCloseAfterPlayEnd, setScheduleClose, useCloseAfterPlayEnd, useScheduleCloseCountDown } from "@/utils/scheduleClose";
import timeformat from "@/utils/timeformat";
import PanelBase from "../base/panelBase";
import Divider from "@/components/base/divider";
import PanelHeader from "../base/panelHeader";
import Checkbox from "@/components/base/checkbox";
import { Pressable } from "react-native-gesture-handler";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";


const shortCutTimes = [10, 20, 30, 45, 60] as const;


function CountDownHeader() {
    const countDown = useScheduleCloseCountDown();
    const { t } = useI18N();

    return (
        <PanelHeader
            hideDivider
            hideButtons
            title={countDown === null
                ? t("sidebar.scheduleClose")
                : t("panel.timingClose.countdown", { time: timeformat(countDown) })}
        />
    );
}



export default function TimingClose() {
    const closeAfterPlay = useCloseAfterPlayEnd();
    const countDown = useScheduleCloseCountDown();

    const isCountingDown = countDown !== null;
    const { t } = useI18N();

    return (
        <PanelBase
            keyboardAvoidBehavior="none"
            positionMethod='top'
            height={vh(56)}
            renderBody={() => (
                <>
                    <CountDownHeader />
                    <Divider />
                    <View style={styles.bodyContainer}>
                        {shortCutTimes.map((time, index) => (
                            <TouchableOpacity style={styles.timeItem} key={index} activeOpacity={0.6} onPress={() => {
                                setScheduleClose(
                                    Date.now() + time * 60000,
                                );
                            }}>
                                <ThemeText>{time}</ThemeText>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.timeItem} key='customize' activeOpacity={0.6} onPress={() => {
                            showDialog("SetScheduleCloseTimeDialog", {
                                onOk: (minutes: number) => {
                                    setScheduleClose(Date.now() + minutes * 60000);
                                },
                            });
                        }}>
                            <ThemeText>{t("panel.timingClose.customize")}</ThemeText>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.bottomLine}>
                        <Pressable style={styles.closeAfterPlayContainer} onPress={() => {
                            setCloseAfterPlayEnd(!closeAfterPlay);
                        }}>
                            <Checkbox checked={closeAfterPlay} />
                            <ThemeText style={styles.bottomLineText}>{t("panel.timingClose.closeAfterPlay")}</ThemeText>
                        </Pressable>
                        {isCountingDown && (
                            <TouchableOpacity style={styles.cancelButton} onPress={() => {
                                setScheduleClose(null);
                            }}>
                                <ThemeText style={styles.cancelButtonText}>{t("panel.timingClose.cancelScheduleClose")}</ThemeText>
                            </TouchableOpacity>
                        )}
                    </View>

                </>
            )}
        />
    );
}


const styles = StyleSheet.create({
    header: {
        width: rpx(750),
        paddingHorizontal: rpx(24),
        height: rpx(90),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    bodyContainer: {
        width: "100%",
        height: 80,
        padding: rpx(24),
        gap: rpx(16),
        flexDirection: "row",
    },
    timeItem: {
        flex: 1,
        backgroundColor: "#99999999",
        borderRadius: rpx(12),
        alignItems: "center",
        justifyContent: "center",
    },
    bottomLine: {
        width: "100%",
        marginTop: rpx(36),
        height: 48,
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    cancelButton: {
        paddingHorizontal: rpx(16),
        paddingVertical: 12,
        backgroundColor: "#ff666699",
        borderRadius: rpx(8),
    },
    cancelButtonText: {
        // 白字压在 #ff666699 功能色底上（定时取消=警示功能色特例，硬编码保留）
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
