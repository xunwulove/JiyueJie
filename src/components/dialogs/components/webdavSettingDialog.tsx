import React, { useRef } from "react";
import { StyleSheet, View } from "react-native";
import Dialog from "./base";
import { hideDialog } from "../useDialog";
import Input from "@/components/base/input";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import { fontSizeConst } from "@/constants/uiConst";

interface IWebdavSettingDialogProps {
    initValues?: Record<string, string>;
    /** 保存回调：values 为 url/username/password；close 为关闭浮窗函数 */
    onOk: (values: Record<string, string>, close: () => void) => void;
    onCancel?: () => void;
}

/** WebDAV 设置三级浮窗（对齐 APlayer Level3Dialog：URL/用户名/密码 输入 + 取消/确定）。
 * 此前为底部面板（SetUserVariables），面板内 RNGH ScrollView 会抢占点击导致输入框无法聚焦弹键盘，
 * 改三级浮窗后输入正常（Dialog 内容区无手势滚动冲突） */
export default function WebDAVSettingDialog(props: IWebdavSettingDialogProps) {
    const { t } = useI18N();
    const { onOk, onCancel, initValues = {} } = props;

    const colors = useColors();
    const resultRef = useRef({ ...initValues });

    const fields = [
        { key: "url", name: "URL", hint: t("backupAndResume.webdavUrl") },
        { key: "username", name: t("common.username") },
        { key: "password", name: t("common.password"), secure: true },
    ];

    return (
        <Dialog
            onDismiss={() => {
                // 遮罩/返回键与"取消"一致：触发 onCancel 后关闭
                onCancel?.();
                hideDialog();
            }}>
            <Dialog.Title withDivider>{t("backupAndResume.webdavSettings")}</Dialog.Title>
            <Dialog.Content>
                {fields.map(it => (
                    <View key={it.key} style={styles.fieldRow}>
                        <ThemeText
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={styles.varName}>
                            {it.name}
                        </ThemeText>
                        <Input
                            defaultValue={initValues[it.key]}
                            onChangeText={e => {
                                resultRef.current[it.key] = e;
                            }}
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.placeholder,
                                },
                            ]}
                            placeholder={it.hint}
                            secureTextEntry={it.secure}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                ))}
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress() {
                            onCancel?.();
                            hideDialog();
                        },
                    },
                    {
                        title: t("common.confirm"),
                        type: "primary",
                        onPress() {
                            onOk(resultRef.current, hideDialog);
                        },
                    },
                ]}
            />
        </Dialog>
    );
}

const styles = StyleSheet.create({
    fieldRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    varName: {
        maxWidth: "35%",
        fontSize: fontSizeConst.content,
    },
    input: {
        width: "50%",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
});
