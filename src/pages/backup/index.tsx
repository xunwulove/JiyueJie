import React from "react";
import { StyleSheet } from "react-native";
import StatusBar from "@/components/base/statusBar";
import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import BackupSetting from "@/pages/setting/settingTypes/backupSetting";

/** 备份与恢复（独立二级页） - 复用备份设置（对齐 APlayer BackupPage） */
export default function Backup() {
    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>备份与恢复</AppBar>
            <HorizontalSafeAreaView style={styles.wrapper}>
                <BackupSetting />
            </HorizontalSafeAreaView>
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
});
