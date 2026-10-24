import React from "react";
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "@/components/base/themeText";
import LinkText from "@/components/base/linkText";
import useCheckUpdate from "@/hooks/useCheckUpdate.ts";
import deviceInfoModule from "react-native-device-info";
import useColors from "@/hooks/useColors";
import Color from "color";
import LinearGradient from "react-native-linear-gradient";

/**
 * 关于页（设置二级页）：
 * 顶部品牌渐变卡（品牌图 + 应用名 + 版本 + 检查更新） + 下方分组卡片（关于/开源许可/更新与音源/插件提示）
 * 全部使用 dp 固定尺寸（与列表行、卡片体系一致），手机/平板统一布局，不再随 rpx 放大
 */
export default function AboutSetting() {
    // 不在挂载时自动检查更新（避免每次进入关于页都发网络请求），
    // 由下方「检查更新」按钮手动触发
    const checkAndShowResult = useCheckUpdate(false);
    const colors = useColors();
    const appName = deviceInfoModule.getApplicationName();
    const appVersion = deviceInfoModule.getVersion();
    const primary = colors.primary;
    const dividerColor = Color(
        (colors as any).divider ?? "#E2E8F0",
    )
        .alpha(0.35)
        .toString();

    const cardStyle = {
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: dividerColor,
        padding: 16,
        marginBottom: 16,
    };

    return (
        <ScrollView
            style={style.wrapper}
            contentContainerStyle={style.scrollContent}>
            {/* 品牌渐变卡 */}
            <LinearGradient
                colors={[
                    Color(primary).alpha(0.18).toString(),
                    Color(primary).alpha(0.05).toString(),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    style.brandCard,
                    {
                        borderColor: dividerColor,
                    },
                ]}>
                <Image
                    source={ImgAsset.brandLogo}
                    style={style.brandImage}
                    resizeMode="contain"
                />
                <View style={style.brandInfo}>
                    <ThemeText
                        fontSize="title"
                        fontWeight="bold"
                        numberOfLines={1}>
                        {appName}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={style.brandVersion}
                        numberOfLines={1}>
                        版本 {appVersion} · 个人自用项目
                    </ThemeText>
                    <Pressable
                        style={({ pressed }) => [
                            style.updateBtn,
                            {
                                backgroundColor: Color(primary)
                                    .alpha(0.1)
                                    .toString(),
                            },
                            pressed ? { opacity: 0.6 } : null,
                        ]}
                        onPress={() => checkAndShowResult(true)}>
                        <ThemeText
                            fontSize="normal"
                            fontWeight="medium"
                            color={primary}>
                            检查更新
                        </ThemeText>
                    </Pressable>
                </View>
            </LinearGradient>

            {/* 关于本软件 */}
            <View style={cardStyle}>
                <ThemeText
                    fontSize="content"
                    fontWeight="bold"
                    style={style.cardTitle}>
                    关于本软件
                </ThemeText>
                <ThemeText style={style.cardText}>
                    极悦界是一款基于{" "}
                    <ThemeText fontWeight="bold">MusicFree</ThemeText>{" "}
                    二次开发的本地音乐播放器，继承了插件式音源架构与本地优先的播放体验，
                    并按平板/手机的交互习惯重构了界面。本项目为个人自用项目，不对外分发。
                </ThemeText>
            </View>

            {/* 开源与许可 */}
            <View style={cardStyle}>
                <ThemeText
                    fontSize="content"
                    fontWeight="bold"
                    style={style.cardTitle}>
                    开源与许可
                </ThemeText>
                <ThemeText style={style.cardText}>
                    本软件基于{" "}
                    <ThemeText fontWeight="bold">AGPL-3.0 协议</ThemeText>{" "}
                    开源的 MusicFree 二次开发，保留并遵守如下约定：
                </ThemeText>
                <ThemeText style={style.cardText}>
                    1. 二次分发版必须同样遵循 AGPL 3.0 协议，开源且免费
                </ThemeText>
                <ThemeText style={style.cardText}>
                    2. 合法合规使用代码，不要用于商业用途；修改后的软件造成的任何问题由使用此代码的开发者承担
                </ThemeText>
                <ThemeText style={style.cardText}>
                    3. 打包、二次分发时请保留代码出处：{" "}
                    <LinkText linkTo="https://github.com/maotoumao/MusicFree">
                        https://github.com/maotoumao/MusicFree
                    </LinkText>
                </ThemeText>
                <ThemeText style={style.cardText}>
                    原项目由猫头猫（maotoumao）开发维护，感谢原作者的辛勤付出。
                </ThemeText>
            </View>

            {/* 更新与音源 */}
            <View style={cardStyle}>
                <ThemeText
                    fontSize="content"
                    fontWeight="bold"
                    style={style.cardTitle}>
                    更新与音源
                </ThemeText>
                <ThemeText style={style.cardText}>
                    软件更新与音源订阅统一托管在 gitee 仓库{" "}
                    <LinkText linkTo="https://gitee.com/xunwulove/jiyuejie">
                        xunwulove/jiyuejie
                    </LinkText>
                    ：软件更新通过软件内「检查更新」完成；音源插件支持订阅自动更新，
                    可在「音源管理」中管理订阅与排序。
                </ThemeText>
            </View>

            {/* 插件安全提示 */}
            <View style={cardStyle}>
                <ThemeText
                    fontSize="content"
                    fontWeight="bold"
                    style={style.cardTitle}>
                    插件安全提示
                </ThemeText>
                <ThemeText style={style.cardText}>
                    本软件需要通过插件来完成包括播放、搜索在内的大部分功能。如果你是从第三方下载的插件，
                    <ThemeText fontWeight="bold">
                        请一定谨慎识别这些插件的安全性，保护好自己。
                    </ThemeText>
                    （注意：插件以及插件可能产生的数据与本软件无关，请使用者合理合法使用。）
                </ThemeText>
            </View>

            <ThemeText
                fontSize="description"
                fontColor="textSecondary"
                style={style.by}>
                by 极悦界
            </ThemeText>
        </ScrollView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 48,
    },
    brandCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 20,
        marginBottom: 16,
    },
    brandImage: {
        width: 88,
        height: 88,
        borderRadius: 19,
        marginRight: 16,
    },
    brandInfo: {
        flex: 1,
    },
    brandVersion: {
        marginTop: 6,
    },
    updateBtn: {
        alignSelf: "flex-start",
        marginTop: 12,
        height: 34,
        paddingHorizontal: 20,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },
    cardTitle: {
        marginBottom: 4,
    },
    cardText: {
        marginTop: 6,
        lineHeight: 22,
    },
    by: {
        textAlign: "center",
        marginTop: 4,
    },
});
