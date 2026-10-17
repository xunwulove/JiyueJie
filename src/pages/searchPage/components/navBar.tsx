import Icon from "@/components/base/icon.tsx";
import IconButton from "@/components/base/iconButton";
import Input from "@/components/base/input";
import Button from "@/components/base/textButton.tsx";
import { iconSizeConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { useNavigation } from "@react-navigation/native";
import { useAtom, useSetAtom } from "jotai";
import React from "react";
import { StyleSheet, View } from "react-native";
import { addHistory } from "../common/historySearch";
import useSearch from "../hooks/useSearch";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "../store/atoms";

export default function NavBar({ hideBack }: { hideBack?: boolean }) {
    const navigation = useNavigation<any>();
    const search = useSearch();
    const [query, setQuery] = useAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const colors = useColors();
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    const onSearchSubmit = async () => {
        if (query === "") {
            return;
        }
        setSearchResultsState(initSearchResults);
        setPageStatus(prev =>
            prev === PageStatus.EDITING ? PageStatus.SEARCHING : prev,
        );
        await search(query, 1);
        await addHistory(query);
    };

    const isDark = (colors as any).dark === true;
    const searchBg = (colors as any).placeholder
        ? (colors as any).placeholder
        : isDark
            ? "rgba(128,128,128,0.15)"
            : "rgba(128,128,128,0.12)";
    const searchIconColor = (colors as any).placeholder
        ? "rgba(128,128,128,0.8)"
        : isDark
            ? "rgba(226,232,240,0.7)"
            : "rgba(30,41,59,0.7)";

    return (
        <View style={[style.appbar, { backgroundColor: "transparent" }]}>
            {hideBack ? null : (
                <IconButton
                    name="arrow-left"
                    sizeType="normal"
                    color={searchIconColor}
                    style={style.backBtn}
                    onPress={() => {
                        navigation?.goBack?.();
                    }}
                />
            )}
            <View style={style.searchBarContainer}>
                <Icon
                    name="magnifying-glass"
                    color={searchIconColor}
                    size={iconSizeConst.small}
                    style={style.magnify}
                />
                <Input
                    autoFocus
                    style={[
                        style.searchBar,
                        {
                            color: colors.text,
                            backgroundColor: "transparent", // M3 OutlinedTextField 透明底 + 描边
                            borderColor: (colors as any).outline ?? searchBg,
                        },
                    ]}
                    accessible
                    accessibilityLabel={t("searchPage.searchLabel.a11y")}
                    accessibilityHint={t("searchPage.searchPlaceHolder")}
                    onFocus={() => {
                        setPageStatus(PageStatus.EDITING);
                    }}
                    placeholderTextColor={searchIconColor}
                    placeholder={t("searchPage.searchPlaceHolder")}
                    onSubmitEditing={onSearchSubmit}
                    onChangeText={_ => {
                        if (_ === "") {
                            setPageStatus(PageStatus.EDITING);
                        }
                        setQuery(_);
                    }}
                    value={query}
                />
                {query.length ? (
                    <IconButton
                        style={style.close}
                        sizeType="light"
                        onPress={() => {
                            setQuery("");
                            setPageStatus(PageStatus.EDITING);
                        }}
                        color={searchIconColor}
                        name="x-mark"
                    />
                ) : null}
            </View>
            <Button
                style={[style.button]}
                hitSlop={0}
                fontColor={"primary"}
                onPress={onSearchSubmit}>
                {t("common.search")}
            </Button>
        </View>
    );
}

const style = StyleSheet.create({
    appbar: {
        paddingRight: 0,
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: 56, // 对齐 APlayer CommonAppBar 高
    },
    backBtn: {
        marginLeft: 8,
    },
    button: {
        paddingHorizontal: 16,
        height: "100%",
        justifyContent: "center",
        flexDirection: "row",
        alignItems: "center",
    },
    searchBarContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    searchBar: {
        minWidth: 240,
        flex: 1,
        paddingHorizontal: 44,
        borderRadius: 12, // 对齐 APlayer OutlinedTextField 圆角 12
        height: 56,
        maxHeight: 56,
        alignItems: "center",
        borderWidth: 1, // M3 OutlinedTextField 描边
        borderStyle: "solid",
    },
    magnify: {
        position: "absolute",
        left: 12,
        zIndex: 100,
    },
    close: {
        position: "absolute",
        right: 12,
    },
});
