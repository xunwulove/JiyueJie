import React from "react";
import { StyleProp } from "react-native";
import type { ImageStyle as FastImageStyle } from "react-native-fast-image";
import FastImage from "./fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import SyntheticCover from "./syntheticCover";

/**
 * 统一歌曲封面：有封面 → 真实封面（FastImage）；无封面 → 自制合成封面（底图+歌名）。
 * 用在一个专辑封面展示位（播放条/平板左播放/全屏大封面等）。
 */
interface IProps {
    musicItem?: IMusic.IMusicItem | null;
    style?: StyleProp<FastImageStyle>;
    resizeMode?: "cover" | "contain" | "stretch" | "center";
}

export default function SongCover(props: IProps) {
    const { musicItem, style, resizeMode } = props;
    const hasArtwork =
        typeof musicItem?.artwork === "string" &&
        musicItem.artwork.length > 0;
    if (hasArtwork) {
        return (
            <FastImage
                style={style}
                source={musicItem.artwork}
                placeholderSource={ImgAsset.albumDefault}
                resizeMode={resizeMode}
            />
        );
    }
    return <SyntheticCover style={style} />;
}
