import React from "react";
import StatusBar from "@/components/base/statusBar";
import DownloadingList from "./downloadingList";
import MusicBar from "@/components/musicBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";

export default function Downloading() {
    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar
                actions={[
                    {
                        icon: "ellipsis-vertical",
                        onPress() {
                            // 三点即"下载设置"本身：直接弹三级浮窗
                            showDialog("DownloadSettingsDialog");
                        },
                    },
                ]}>
                <ThemeText fontSize="title" fontWeight="bold">
                    下载管理
                </ThemeText>
            </AppBar>
            <DownloadingList />
            <MusicBar />
        </VerticalSafeAreaView>
    );
}
