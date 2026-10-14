import React, { useState } from "react";
import { useI18N } from "@/core/i18n";
import { showDialog, hideDialog } from "../useDialog";
import Dialog from "./base";
import Mode from "@/pages/setting/settingTypes/themeSetting/mode";
import Background from "@/pages/setting/settingTypes/themeSetting/background";
import BackgroundCustom, {
    IMAGE_EXTENSIONS,
} from "@/pages/setting/settingTypes/themeSetting/backgroundCustom";
import Config from "@/core/appConfig";
import Theme from "@/core/theme";
import Toast from "@/utils/toast";

/**
 * 主题设置三级浮窗（B3 决策：设置页点"主题"直接弹三级浮窗，
 * 不再叠二级设置覆盖层；自定义取色功能已去除，自定义背景于 2026-10-14 恢复入口）
 * 2026-10-14 调整：浅色/深色/自定义背景三卡片并列；自定义背景点卡片展开详细控件；
 * 底部按钮栏加"恢复默认"（默认 = 浅色模式 + 无自定义背景 + 不跟随系统）
 * 2026-10-15 优化（方案1）：未设置背景时点"自定义背景"卡片 → 直接打开选图器，
 * 选完图自动展开面板（预览+模糊/透明滑块）；已设置背景时点卡片 → 展开面板调参数。
 */
export default function ThemeSettingDialog() {
    const { t } = useI18N();
    const [customOpen, setCustomOpen] = useState(false);

    const resetDefault = () => {
        // 恢复默认：浅色模式 + 清除自定义背景 + 取消跟随系统（默认主题 = p-light）
        Config.setConfig("theme.followSystem", false);
        Theme.setTheme("p-light");
        Theme.setBackground({ url: undefined });
        hideDialog();
        Toast.success(t("themeSettings.resetDefaultToast"));
    };

    /** 选图（文件选择浮窗会替换当前主题浮窗——对话框全局单值；确认/取消后重开主题浮窗，
        保持"主题浮窗 → 选图 → 回到主题浮窗"闭环；选完自动展开自定义背景面板） */
    const pickBackgroundImage = () => {
        const reopenThemeDialog = () => {
            // 必须延迟重开：confirm/cancel 的 hideDialog() 是同步的，
            // 直接 showDialog 会被它清掉（"选完图浮窗全关、没机会调模糊/透明"根因，同款 setTimeout(0) 写法）
            setTimeout(() => {
                showDialog("ThemeSettingDialog");
            }, 0);
        };
        showDialog("FileSelectorDialog", {
            fileType: "file",
            actionText: "设为背景",
            matchExtension: path =>
                IMAGE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext)),
            onAction: files => {
                const file = files?.[0];
                if (file?.path) {
                    Theme.setBackground({ url: `file://${file.path}` });
                    // 选完自动展开面板：立即调节模糊/透明度
                    setCustomOpen(true);
                }
                reopenThemeDialog();
                return true;
            },
            onCancel: reopenThemeDialog,
        });
    };

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>{t("sidebar.themeSettings")}</Dialog.Title>
            <Dialog.Content
                needScroll
                style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
                <Mode />
                <Background
                    customOpen={customOpen}
                    onCustomPress={() => setCustomOpen(v => !v)}
                    onDirectPick={pickBackgroundImage}
                />
                {customOpen ? (
                    <BackgroundCustom onPickImage={pickBackgroundImage} />
                ) : null}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("themeSettings.resetDefault"),
                        type: "normal",
                        onPress: resetDefault,
                    },
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
