import React from "react";
import { useI18N } from "@/core/i18n";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import Mode from "@/pages/setting/settingTypes/themeSetting/mode";
import Background from "@/pages/setting/settingTypes/themeSetting/background";

/**
 * 主题设置三级浮窗（B3 决策：设置页点"主题"直接弹三级浮窗，
 * 不再叠二级设置覆盖层；自定义取色功能已去除）
 */
export default function ThemeSettingDialog() {
    const { t } = useI18N();

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{t("sidebar.themeSettings")}</Dialog.Title>
            <Dialog.Content
                needScroll
                style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
                <Mode />
                <Background />
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
