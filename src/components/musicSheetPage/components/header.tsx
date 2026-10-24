import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import PlayAllBar from "@/components/base/playAllBar";
import useColors from "@/hooks/useColors";

interface IHeaderProps {
    musicSheet: IMusic.IMusicSheetItem | null;
    musicList: IMusic.IMusicItem[] | null;
    canStar?: boolean;
    // 歌单来源音源名（插件歌单详情传入，头部展示"来源：xxx"）
    sourcePluginName?: string;
}
export default function Header(props: IHeaderProps) {
    const { musicSheet, musicList, canStar, sourcePluginName } = props;
    const colors = useColors();

    const [maxLines, setMaxLines] = useState<number | undefined>(6);

    const toggleShowMore = () => {
        if (maxLines) {
            setMaxLines(undefined);
        } else {
            setMaxLines(6);
        }
    };

    return (
        <View style={{ backgroundColor: colors.card }}>
            <View style={style.wrapper}>
                <View style={style.content}>
                    <FastImage
                        style={style.coverImg}
                        source={
                            musicSheet?.artwork ??
                            musicSheet?.coverImg ??
                            // 兜底：歌单本身无封面时取第一首歌封面（推荐歌单标签对象等场景）
                            musicList?.[0]?.artwork ??
                            musicList?.[0]?.coverImg
                        }
                        placeholderSource={ImgAsset.albumDefault}
                    />
                    <View style={style.details}>
                        <ThemeText numberOfLines={3} fontSize="title">
                            {musicSheet?.title}
                        </ThemeText>
                        <View>
                            <ThemeText
                                fontColor="textSecondary"
                                fontSize="description">
                                共
                                {musicSheet?.worksNum ??
                                    (musicList ? musicList.length ?? 0 : "-")}
                                首{" "}
                            </ThemeText>
                            {sourcePluginName ? (
                                <ThemeText
                                    fontColor="textSecondary"
                                    fontSize="description">
                                    来源：{sourcePluginName}
                                </ThemeText>
                            ) : null}
                        </View>
                    </View>
                </View>
                {musicSheet?.description ? (
                    <Pressable onPress={toggleShowMore}>
                        <View
                            style={style.albumDesc}
                            // onLayout={evt => {
                            //     console.log(evt.nativeEvent.layout);
                            // }}
                        >
                            <ThemeText
                                fontColor="textSecondary"
                                fontSize="description"
                                numberOfLines={maxLines}>
                                {musicSheet.description}
                            </ThemeText>
                        </View>
                    </Pressable>
                ) : null}
            </View>
            <PlayAllBar
                canStar={canStar}
                musicList={musicList}
                musicSheet={musicSheet}
            />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        // 固定 dp：歌单头部内边距跨屏稳定（原 rpx(24) 手机≈11.5dp/平板≈25.6dp）
        padding: 20,
        justifyContent: "center",
        alignItems: "flex-start",
    },
    content: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
    },
    coverImg: {
        // 固定 dp：封面 176dp 方图 + 圆角 20（原 rpx(210)/rpx(24)）
        width: 176,
        height: 176,
        borderRadius: 20,
    },
    details: {
        flex: 1,
        paddingHorizontal: 32,
        justifyContent: "center",
    },
    divider: {
        marginVertical: 16,
    },

    albumDesc: {
        width: "100%",
        marginTop: 24,
    },
});
