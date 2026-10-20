import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import Input from "@/components/base/input";
import { FlatList } from "react-native-gesture-handler";
import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import Config from "@/core/appConfig";
import { hideDialog, showDialog } from "../useDialog";
import Dialog from "./base";
import { iconSizeConst } from "@/constants/uiConst";
import Toast from "@/utils/toast";
import { DEFAULT_PLUGIN_SUBSCRIPTION_URL } from "@/constants/defaultPluginSubscription";
interface ISubscriptionSettingDialogProps {
    /** 更新订阅（由调用方传入：读取订阅列表逐个拉取安装插件） */
    onUpdateSubscription?: () => void;
}
interface ISubscriptionItem {
    url: string;
}
function getSubscriptions(): ISubscriptionItem[] {
    const raw = Config.getConfig("plugin.subscribeUrl");
    if (!raw) {
        // 未配置订阅时，回退内置默认订阅源（极悦界音源库）
        return [{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }];
    }
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const list = parsed.filter(
                (it: ISubscriptionItem) => it && typeof it.url === "string",
            );
            // 配置存在但为空数组：视为未配置，回退默认订阅源
            return list.length ? list : [{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }];
        }
    } catch {
        // 兼容旧格式：纯字符串数组
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                const list = parsed
                    .filter((u: unknown) => typeof u === "string")
                    .map((url: string) => ({ url }));
                return list.length
                    ? list
                    : [{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }];
            }
        } catch {
            return [{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }];
        }
    }
    return [{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }];
}
function saveSubscriptions(list: ISubscriptionItem[]) {
    Config.setConfig(
        "plugin.subscribeUrl",
        JSON.stringify(list.map(it => ({ url: it.url }))),
    );
}
/**
 * 订阅设置三级浮窗（音源管理三点菜单"订阅设置"项）：
 * 订阅源列表（增/删）+ 更新订阅；删除确认再弹三级（SimpleDialog）
 */
export default function SubscriptionSettingDialog(
    props: ISubscriptionSettingDialogProps,
) {
    const { onUpdateSubscription } = props ?? {};
    const { t } = useI18N();
    const colors = useColors();
    const [urls, setUrls] = useState<ISubscriptionItem[]>(
        getSubscriptions(),
    );
    const [inputUrl, setInputUrl] = useState("");
    const listData = useMemo(() => urls, [urls]);
    function onAdd() {
        const text = inputUrl.trim();
        if (!text) {
            Toast.warn(t("toast.subscriptionUrlInput"));
            return;
        }
        if (urls.some(it => it.url === text)) {
            Toast.warn(t("toast.subscriptionExists"));
            return;
        }
        const next = [...urls, { url: text }];
        setUrls(next);
        saveSubscriptions(next);
        setInputUrl("");
        Toast.success(t("toast.subscriptionAdded"));
    }
    function onDelete(item: ISubscriptionItem) {
        // 三级内再弹三级（删除确认），遵守三级规范
        showDialog("SimpleDialog", {
            title: "删除订阅",
            content: `确定删除订阅「${item.url}」？`,
            okText: "删除",
            onOk: () => {
                const next = urls.filter(it => it.url !== item.url);
                setUrls(next);
                saveSubscriptions(next);
                Toast.success(t("toast.subscriptionDeleted"));
            },
        });
    }
    /** 恢复默认订阅：重置为内置默认订阅源（极悦界音源库） */
    function onRestoreDefault() {
        const next = [{ url: DEFAULT_PLUGIN_SUBSCRIPTION_URL }];
        setUrls(next);
        saveSubscriptions(next);
        Toast.success(t("toast.subscriptionRestored"));
    }
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>订阅设置</Dialog.Title>
            <Dialog.Content needScroll>
                <FlatList
                    data={listData}
                    keyExtractor={it => it.url}
                    ListEmptyComponent={
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.empty}>
                            暂无订阅，可在下方添加订阅链接
                        </ThemeText>
                    }
                    ItemSeparatorComponent={() => (
                        <ListDivider marginLeft={16} />
                    )}
                    renderItem={({ item }) => (
                        <ListItem
                            withHorizontalPadding
                            heightType="small"
                            onPress={() => {
                                onDelete(item);
                            }}>
                            <ListItem.Content title={item.url} />
                            <Pressable
                                hitSlop={8}
                                onPress={() => onDelete(item)}>
                                <Icon
                                    name="trash-outline"
                                    size={iconSizeConst.light}
                                    color={colors.textSecondary}
                                />
                            </Pressable>
                        </ListItem>
                    )}
                />
                <View style={styles.addRow}>
                    <Input
                        value={inputUrl}
                        onChangeText={setInputUrl}
                        placeholder="输入订阅链接，如 https://cdn.jsdelivr.net/gh/xxx/plugins.json"
                        style={styles.input}
                        onSubmitEditing={onAdd}
                    />
                    <Pressable
                        hitSlop={8}
                        style={styles.addBtn}
                        onPress={onAdd}>
                        <Icon
                            name="plus"
                            size={iconSizeConst.normal}
                            color={colors.primary}
                        />
                    </Pressable>
                </View>
            </Dialog.Content>
            <Dialog.Actions
                actions={[
                    {
                        title: t("common.cancel"),
                        type: "normal",
                        onPress: hideDialog,
                    },
                    {
                        title: "恢复默认",
                        type: "normal",
                        onPress: onRestoreDefault,
                    },
                    {
                        title: "更新订阅",
                        type: "primary",
                        onPress: () => {
                            onUpdateSubscription?.();
                            hideDialog();
                        },
                    },
                ]}
            />
        </Dialog>
    );
}
const styles = StyleSheet.create({
    empty: {
        paddingVertical: rpx(24),
        textAlign: "center",
    },
    addRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(8),
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: "#99999999",
        paddingVertical: 8,
    },
    addBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
});
