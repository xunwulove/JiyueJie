import React, { useEffect, useMemo, useRef } from "react";
import { FlatList } from "react-native-gesture-handler";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import ListItem from "@/components/base/listItem";
import { ListDivider } from "@/components/base/divider";
import useOrientation from "@/hooks/useOrientation";
import { vmax, vmin } from "@/utils/rpx";
import { IIconName } from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors.ts";
import ThemeText from "@/components/base/themeText";
import { iconSizeConst } from "@/constants/uiConst";
import { Pressable, View } from "react-native";
interface ISortOption<T extends string = string> {
    label: string;
    value: T;
    icon?: IIconName;
}
interface ISortDialogProps<T extends string = string> {
    title: string;
    options: Array<ISortOption<T>>;
    defaultSelected: T;
    /** 当前排序方向（asc 升序 / desc 降序） */
    direction: "asc" | "desc";
    onOk: (value: T, direction: "asc" | "desc") => void;
}
/**
 * 排序三级浮窗（对齐三级页面规范：渐变标题行 + 单选列表 + 底部同高选项行）：
 * 点选维度立即生效并关闭；再次点当前维度 = 切换升/降序；
 * 底部选项行"升序 / 降序"点击切换方向并生效。
 */
export default function SortDialog(props: ISortDialogProps) {
    const { title, options, defaultSelected, direction, onOk } = props;
    const orientation = useOrientation();
    const colors = useColors();
    const ref = useRef<FlatList | null>(null);
    const defaultSelectedIndex = useMemo(() => {
        return options.findIndex(item => item.value === defaultSelected);
    }, [options, defaultSelected]);
    useEffect(() => {
        if (ref.current && defaultSelectedIndex - 3 >= 0) {
            ref.current.scrollToIndex({
                index: defaultSelectedIndex - 3,
                animated: false,
            });
        }
    }, []);
    const apply = (value: string, dir: "asc" | "desc") => {
        // 单槽位浮窗：先关闭再触发回调，避免 onOk 内新浮窗被连带清掉
        hideDialog();
        setTimeout(() => onOk?.(value as any, dir), 0);
    };
    const toggleDirection = (dir: "asc" | "desc") => {
        apply(defaultSelected, dir);
    };
    return (
        <Dialog onDismiss={hideDialog}>
            <Dialog.Title>
                <ThemeText
                    fontSize="title"
                    fontWeight="bold"
                    numberOfLines={1}>
                    {title}
                </ThemeText>
            </Dialog.Title>
            <FlatList
                ref={ref}
                style={{
                    maxHeight:
                        orientation === "horizontal" ? vmin(60) : vmax(60),
                }}
                data={options}
                getItemLayout={(_, index) => ({
                    length: ListItem.Size.small,
                    offset: ListItem.Size.small * index,
                    index,
                })}
                ListFooterComponent={<View style={styles.footer} />}
                ItemSeparatorComponent={() => (
                    <ListDivider marginLeft={16} />
                )}
                renderItem={({ item }) => {
                    const selected = item.value === defaultSelected;
                    return (
                        <ListItem
                            withHorizontalPadding
                            onPress={() => {
                                // 再点当前维度 = 切换升/降序；否则选中该维度
                                apply(
                                    item.value,
                                    selected
                                        ? direction === "asc"
                                            ? "desc"
                                            : "asc"
                                        : direction,
                                );
                            }}
                            heightType="small">
                            {item.icon ? (
                                <ListItem.ListItemIcon
                                    icon={item.icon}
                                    iconSize={iconSizeConst.light}
                                />
                            ) : null}
                            <ListItem.Content title={item.label} />
                            {selected ? (
                                <ListItem.ListItemIcon
                                    icon={"check"}
                                    iconSize={iconSizeConst.light}
                                    color={colors.primary}
                                />
                            ) : null}
                        </ListItem>
                    );
                }}
            />
            <Dialog.Actions>
                <Pressable
                    style={styles.dirButton}
                    onPress={() => toggleDirection("asc")}>
                    <ThemeText
                        fontSize="subTitle"
                        fontWeight={
                            direction === "asc" ? "bold" : "regular"
                        }
                        color={
                            direction === "asc"
                                ? colors.primary
                                : colors.textSecondary
                        }>
                        升序
                    </ThemeText>
                </Pressable>
                <Pressable
                    style={styles.dirButton}
                    onPress={() => toggleDirection("desc")}>
                    <ThemeText
                        fontSize="subTitle"
                        fontWeight={
                            direction === "desc" ? "bold" : "regular"
                        }
                        color={
                            direction === "desc"
                                ? colors.primary
                                : colors.textSecondary
                        }>
                        降序
                    </ThemeText>
                </Pressable>
            </Dialog.Actions>
        </Dialog>
    );
}
const styles = {
    dirButton: {
        flex: 1,
        height: 52,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
    // 2026-10-24 规范统一：列表末项距底部按钮行分割线 12（base 规范）
    footer: {
        width: "100%" as const,
        height: 12,
    },
};
