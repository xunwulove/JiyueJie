import React from "react";
import { iconSizeConst } from "@/constants/uiConst";
import { useCurrentMusic } from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import useColors from "@/hooks/useColors";

export default function () {
    const musicItem = useCurrentMusic();
    const colors = useColors();

    const isFavorite = useFavorite(musicItem);

    return isFavorite ? (
        <Icon
            name="heart"
            size={iconSizeConst.normal}
            color="red"
            fill="currentColor"
            onPress={() => {
                if (!musicItem) {
                    return;
                }
                MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
            }}
        />
    ) : (
        <Icon
            name="heart"
            size={iconSizeConst.normal}
            color={colors.textSecondary}
            fill="none"
            onPress={() => {
                if (musicItem) {
                    MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
                }
            }}
        />
    );
}
