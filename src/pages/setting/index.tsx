import React from "react";
import { StyleSheet } from "react-native";
import settingTypes from "./settingTypes";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import StatusBar from "@/components/base/statusBar";
import { useParams } from "@/core/router";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";

export default function Setting() {
    const { type } = useParams<"setting">();
    const settingItem = settingTypes[type];

    const { t } = useI18N();

    return (
        // 2026-10-14 修复：改为 VerticalSafeAreaView（平板只保 bottom），
        // 与其他二级页标题栏高度一致——此前 edges 含 top，平板上标题栏多出一段状态栏高度
        <VerticalSafeAreaView style={style.wrapper}>
            <StatusBar />
            {settingItem.showNav === false ? null : (
                <AppBar>{t(settingItem.i18nKey as any)}</AppBar>
            )}

            <HorizontalSafeAreaView style={style.wrapper}>
                <settingItem.component />
            </HorizontalSafeAreaView>
        </VerticalSafeAreaView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    appbar: {
        shadowColor: "transparent",
        backgroundColor: "#2b333eaa",
    },
    header: {
        backgroundColor: "transparent",
        shadowColor: "transparent",
    },
});
