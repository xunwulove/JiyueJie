import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import rpx from "@/utils/rpx";
import Dialog from "./base";
import Input from "@/components/base/input";
import ThemeText from "@/components/base/themeText";
import { hideDialog } from "../useDialog";
import pluginManager, { Plugin } from "@/core/pluginManager";
import { useI18N } from "@/core/i18n";
import Toast from "@/utils/toast";

interface IPluginSettingDialogProps {
    /** 插件 */
    plugin: Plugin;
}

/**
 * 插件设置 - 三级浮窗：渲染插件声明的 userVariables（自定义输入项）为文本表单。
 * 入口：音源管理页点击插件名字（无 userVariables 时名字不可点、不弹此窗）。
 * 值经 pluginManager.setUserVariables(plugin, values) 存到 plugin.name.userVariables，
 * 插件运行时经 getUserVariables 读取。
 */
export default function PluginSettingDialog(
    props: IPluginSettingDialogProps,
) {
    const { plugin } = props ?? {};
    const { t } = useI18N();

    const variables = useMemo(
        () => plugin?.instance?.userVariables ?? [],
        [plugin],
    );

    const [values, setValues] = useState<Record<string, string>>(() =>
        plugin ? (pluginManager.getUserVariables(plugin) ?? {}) : {},
    );

    function save() {
        if (plugin) {
            pluginManager.setUserVariables(plugin, values);
            Toast.success(t("toast.pluginSettingSaved"));
        }
        hideDialog();
    }

    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title withDivider>
                {plugin?.name ?? t("pluginSetting.pluginSetting.title")}
            </Dialog.Title>
            <Dialog.Content
                needScroll
                style={{
                    paddingHorizontal: rpx(32),
                    paddingTop: rpx(24),
                    paddingBottom: rpx(24),
                }}>
                {variables.length === 0 ? (
                    <ThemeText fontColor="textSecondary" fontSize="normal">
                        {t("pluginSetting.pluginSetting.empty")}
                    </ThemeText>
                ) : (
                    <ScrollView>
                        {variables.map(v => (
                            <View key={v.key} style={styles.field}>
                                <ThemeText fontSize="normal">
                                    {v.name ?? v.key}
                                </ThemeText>
                                <Input
                                    style={styles.input}
                                    value={values[v.key] ?? ""}
                                    onChangeText={txt =>
                                        setValues(prev => ({
                                            ...prev,
                                            [v.key]: txt,
                                        }))
                                    }
                                    placeholder={v.hint}
                                />
                            </View>
                        ))}
                    </ScrollView>
                )}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                    {
                        title: t("common.save"),
                        type: "primary",
                        onPress: save,
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    field: {
        marginBottom: rpx(24),
    },
    input: {
        marginTop: rpx(8),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(128,128,128,0.3)",
    },
});
