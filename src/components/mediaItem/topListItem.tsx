import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors";
import { ListDivider } from "@/components/base/divider";
import Color from "color";
import { ROUTE_PATH, useNavigate } from "@/core/router";

interface ITopListResultsProps {
    pluginHash: string;
    topListItem: IMusic.IMusicSheetItemBase;
}

/**
 * 榜单分类行 - 对齐 APlayer TopListRow：
 * padding 16/10；40dp 圆角10 渐变块（primary 0.85→0.45）+ fire 20dp 白；榜单名 15sp Medium；
 * 描述 12sp（有则显示）；右侧箭头 20sp；行下 ListDivider（缩进 70、colors.divider）
 */
export default function TopListItem(props: ITopListResultsProps) {
    const { pluginHash, topListItem } = props;
    const navigate = useNavigate();
    const colors = useColors();

    return (
        <View>
            <Pressable
                style={({ pressed }) => [
                    styles.row,
                    pressed
                        ? {
                              backgroundColor: Color(colors.primary)
                                  .alpha(0.06)
                                  .toString(),
                          }
                        : null,
                ]}
                onPress={() => {
                    navigate(ROUTE_PATH.TOP_LIST_DETAIL, {
                        pluginHash: pluginHash,
                        topList: topListItem,
                    });
                }}>
                <LinearGradient
                    colors={[
                        Color(colors.primary).alpha(0.85).toString(),
                        Color(colors.primary).alpha(0.45).toString(),
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconBlock}>
                    <Icon name="fire" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.info}>
                    <ThemeText
                        fontSize="body"
                        fontWeight="medium"
                        numberOfLines={1}>
                        {topListItem.title}
                    </ThemeText>
                    {topListItem.description ? (
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            numberOfLines={1}>
                            {topListItem.description}
                        </ThemeText>
                    ) : null}
                </View>
                <ThemeText
                    fontSize="body"
                    fontColor="textSecondary"
                    style={styles.arrow}>
                    ›
                </ThemeText>
            </Pressable>
            {/* marginLeft = 行padding16 + 图标块40 + 间距14，与榜单名左缘对齐 */}
            <ListDivider marginLeft={70} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    iconBlock: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    info: {
        flex: 1,
        marginRight: 8,
    },
    arrow: {
        marginRight: 4,
    },
});
