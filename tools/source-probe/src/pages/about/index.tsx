import React from "react";
import {
    Image,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "@/components/base/themeText";
import LinkText from "@/components/base/linkText";
import deviceInfoModule from "react-native-device-info";
import useColors from "@/hooks/useColors";
import Color from "color";
import LinearGradient from "react-native-linear-gradient";

/**
 * 关于页（源鉴二级页）：
 * 顶部品牌渐变卡（品牌图 + 应用名 + 版本 + 包名） + 下方分组卡片（关于本软件/开源与许可/插件安全提示）
 * 全部使用 dp 固定尺寸，手机/平板统一布局
 */
export default function About() {
    const colors = useColors();
    const appName = deviceInfoModule.getApplicationName();
    const appVersion = deviceInfoModule.getVersion();
    const bundleId = deviceInfoModule.getBundleId();
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
                        版本 {appVersion} · {bundleId}
                    </ThemeText>
                    <ThemeText
                        fontSize="description"
                        fontColor="textSecondary"
                        style={style.brandTag}
                        numberOfLines={1}>
                        音源探测 · 试听 · 能力分档
                    </ThemeText>
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
                    源鉴是一款基于{" "}
                    <ThemeText fontWeight="bold">MusicFree</ThemeText>{" "}
                    生态的音源探测工具：批量检测音源插件的搜索/解析/播放/歌单/歌词能力，
                    自动分档并给出保留或卸载建议，支持历史对比与单源试听。本项目为个人自用项目。
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

            {/* 插件安全提示 */}
            <View style={cardStyle}>
                <ThemeText
                    fontSize="content"
                    fontWeight="bold"
                    style={style.cardTitle}>
                    插件安全提示
                </ThemeText>
                <ThemeText style={style.cardText}>
                    本软件需要通过音源插件来完成探测与试听。如果你是从第三方下载的插件，
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
                by 源鉴
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
    brandTag: {
        marginTop: 4,
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
