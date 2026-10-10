import React from "react";
import ApiSheetsPage from "@/pages/apiSheets";
import MusicBar from "@/components/musicBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import AppBar from "@/components/base/appBar";
import ThemeText from "@/components/base/themeText";

export default function TopList() {
    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <AppBar withStatusBar>
                <ThemeText fontSize="title" fontWeight="bold">
                    排行榜
                </ThemeText>
            </AppBar>
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                <ApiSheetsPage type="toplist" />
            </HorizontalSafeAreaView>
            <MusicBar />
        </VerticalSafeAreaView>
    );
}
