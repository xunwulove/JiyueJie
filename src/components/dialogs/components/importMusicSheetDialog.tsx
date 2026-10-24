import ListItem from "@/components/base/listItem";
import Toast from "@/utils/toast";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ListDivider } from "@/components/base/divider";
import Dialog from "./base";
import { hideDialog, showDialog } from "../useDialog";
import Input from "@/components/base/input";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon.tsx";
import { iconSizeConst } from "@/constants/uiConst";
import * as neteaseApi from "@/core/api/netease";
import PluginManager, { Plugin } from "@/core/pluginManager";
import { platformMatches } from "@/core/playMatcher";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
/** 链接类型：歌单 / 单曲 */
type ImportType = "sheet" | "music";
/** 面板状态：粘贴识别 / 手动选源 / 指定插件解析 */
type Mode = "input" | "choose" | "plugin-input";
/** 链接 → 平台名（供 platformMatches 匹配对应插件；识别不到返回空） */
function detectPlatform(link: string): string {
    const l = link.toLowerCase();
    if (
        l.includes("music.163.com") ||
        l.includes("163cn") ||
        l.includes("netease")
    ) {
        return "网易云音乐";
    }
    if (
        l.includes("y.qq.com") ||
        l.includes("qq.com/music") ||
        l.includes("qmusic")
    ) {
        return "QQ音乐";
    }
    if (l.includes("kugou.com")) {
        return "酷狗音乐";
    }
    if (l.includes("kuwo.cn")) {
        return "酷我音乐";
    }
    if (l.includes("music.douyin.com")) {
        return "汽水音乐";
    }
    if (l.includes("migu.cn")) {
        return "咪咕音乐";
    }
    return "";
}
/** 链接 → 类型：歌单特征 → sheet；单曲特征 → music；否则默认 sheet */
function detectType(link: string): ImportType {
    const l = link.toLowerCase();
    if (/(playlist|songlist|dissid|歌单)/.test(l)) {
        return "sheet";
    }
    if (/(\/song|songmid|songid|单曲)/.test(l)) {
        return "music";
    }
    return "sheet";
}
/** 网易链接 → 歌单/单曲 id（支持 ?id=、#/playlist?id=、/playlist/、/song/ 等格式） */
function extractNeteaseId(link: string): string {
    const q = link.match(/[?&]id=(\d+)/);
    if (q) {
        return q[1];
    }
    const p = link.match(/\/(?:playlist|song)\/(\d+)/);
    if (p) {
        return p[1];
    }
    return "";
}
/**
 * 导入歌单/单曲 - 三级浮窗（对话框体系：居中缩放 + 渐变标题行 + 底部等高同渐变按钮行）。
 * 内置优先（网易直连）→ 插件兜底 → 识别失败手动选源（选源后浮窗内输入，不叠加新层）。
 */
export default function ImportMusicSheetDialog() {
    const { t } = useI18N();
    const colors = useColors();
    const [mode, setMode] = useState<Mode>("input");
    const [query, setQuery] = useState("");
    const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
    const sheetPlugins = useMemo(
        () =>
            PluginManager.getSortedPluginsWithAbility("importMusicSheet"),
        [],
    );
    const musicPlugins = useMemo(
        () =>
            PluginManager.getSortedPluginsWithAbility("importMusicItem"),
        [],
    );
    /** 手动选源兜底列表：支持导入歌单/单曲的插件（去重） */
    const allPlugins = useMemo(() => {
        const merged = [...sheetPlugins];
        musicPlugins.forEach(p => {
            if (!merged.some(m => m.hash === p.hash)) {
                merged.push(p);
            }
        });
        return merged;
    }, [sheetPlugins, musicPlugins]);
    /** 导入结果统一收尾：成功 → 关闭浮窗 → 提示 → 加入歌单（仍为三级浮窗） */
    function finishImport(
        type: ImportType,
        result: any,
        sourceName?: string,
    ) {
        if (type === "music") {
            if (result) {
                hideDialog();
                setTimeout(() => {
                    showDialog("SimpleDialog", {
                        title: t("panel.importMusicSheet.prepareImport"),
                        content: t(
                            "pluginSetting.pluginItem.options.importMusicDialogContent",
                            { name: result.title },
                        ),
                        onOk() {
                            setTimeout(() => {
                                showDialog("AddToMusicSheetDialog", {
                                    musicItem: result,
                                    newSheetDefaultName: t(
                                        "pluginSetting.pluginItem.options.importMusicToSheetName",
                                        { name: sourceName ?? "导入" },
                                    ),
                                });
                            }, 0);
                        },
                    });
                }, 0);
            } else {
                Toast.warn(t("toast.failToImportMusic"));
            }
        } else {
            if (result && result.length > 0) {
                hideDialog();
                setTimeout(() => {
                    showDialog("SimpleDialog", {
                        title: t("panel.importMusicSheet.prepareImport"),
                        content: t("panel.importMusicSheet.foundSongs", {
                            count: result.length,
                        }),
                        onOk() {
                            setTimeout(() => {
                                showDialog("AddToMusicSheetDialog", {
                                    musicItem: result,
                                });
                            }, 0);
                        },
                    });
                }, 0);
            } else {
                Toast.warn(t("panel.importMusicSheet.invalidLink"));
            }
        }
    }
    /** 插件解析（指定插件） */
    async function importByPlugin(plugin: Plugin, text: string) {
        Toast.success(t("panel.importMusicSheet.importing"));
        const type = detectType(text);
        let result: any = null;
        try {
            result =
                type === "music"
                    ? await plugin.methods.importMusicItem(text)
                    : await plugin.methods.importMusicSheet(text);
        } catch {
            result = null;
        }
        finishImport(type, result, plugin.name);
    }
    /** 内置解析（仅网易云：歌单 getSheetDetail / 单曲 getSongDetail；失败返回 null） */
    async function builtinImport(
        type: ImportType,
        id: string,
    ): Promise<any> {
        try {
            if (type === "music") {
                return await neteaseApi.getSongDetail(id);
            }
            return await neteaseApi.getSheetDetail(id);
        } catch {
            return null;
        }
    }
    /** 提交链接：内置优先（网易云）→ 插件兜底 → 识别失败切手动选源 */
    async function onInputSubmit() {
        const text = (query ?? "").trim();
        if (!text) {
            return;
        }
        const platform = detectPlatform(text);
        const type = detectType(text);
        const pool = type === "music" ? musicPlugins : sheetPlugins;
        // ① 内置优先：仅网易云（QQ 直连已确认全反爬，见 api/qq.ts 注释）
        if (platform === "网易云音乐") {
            const id = extractNeteaseId(text);
            if (id) {
                Toast.success(t("panel.importMusicSheet.importing"));
                const builtin = await builtinImport(type, id);
                if (
                    type === "music"
                        ? !!builtin
                        : builtin && builtin.length > 0
                ) {
                    finishImport(type, builtin, "网易云音乐");
                    return;
                }
            }
        }
        // ② 插件兜底
        if (platform) {
            const matched = pool.find(p =>
                platformMatches(p.instance.platform, platform),
            );
            if (matched) {
                importByPlugin(matched, text);
                return;
            }
        }
        // ③ 识别失败：切手动选源
        setMode("choose");
    }
    /** 底部按钮行（与标题行等高同渐变；随模式变化语义） */
    function renderActions() {
        if (mode === "choose") {
            return [
                {
                    title: t("common.cancel"),
                    type: "normal" as const,
                    onPress() {
                        hideDialog();
                    },
                },
                {
                    title: t("panel.importMusicSheet.backToInput"),
                    type: "primary" as const,
                    onPress() {
                        setMode("input");
                        setQuery("");
                        setSelectedPlugin(null);
                    },
                },
            ];
        }
        return [
            {
                title: t("common.cancel"),
                type: "normal" as const,
                onPress() {
                    hideDialog();
                },
            },
            {
                title: t("common.confirm"),
                type: "primary" as const,
                onPress() {
                    const text = (query ?? "").trim();
                    if (mode === "plugin-input" && selectedPlugin) {
                        if (text) {
                            importByPlugin(selectedPlugin, text);
                        }
                    } else {
                        onInputSubmit();
                    }
                },
            },
        ];
    }
    return (
        <Dialog
            onDismiss={hideDialog}
            onBackPress={() => {
                // 返回手势逐级回退内部态（与 FileSelector 目录回退一致）：plugin-input → choose → input，初始态才关窗
                if (mode === "plugin-input") {
                    setMode("choose");
                    setQuery("");
                    return true;
                }
                if (mode === "choose") {
                    setMode("input");
                    setQuery("");
                    setSelectedPlugin(null);
                    return true;
                }
                return false;
            }}>
            <Dialog.Title>
                {t("panel.importMusicSheet.title")}
            </Dialog.Title>
            <Dialog.Content needScroll>
                {mode === "input" ? (
                    <View>
                        <Input
                            autoFocus
                            style={styles.input}
                            placeholder={t(
                                "panel.importMusicSheet.placeholder",
                            )}
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={onInputSubmit}
                        />
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.hint}>
                            {t("panel.importMusicSheet.autoDetectHint")}
                        </ThemeText>
                    </View>
                ) : mode === "plugin-input" && selectedPlugin ? (
                    <View>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.hint}>
                            {t("panel.importMusicSheet.chooseSource")}：
                            {selectedPlugin.name}
                        </ThemeText>
                        <Input
                            autoFocus
                            style={styles.input}
                            placeholder={t(
                                "panel.importMusicSheet.placeholder",
                            )}
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={() => {
                                if (query.trim()) {
                                    importByPlugin(selectedPlugin, query);
                                }
                            }}
                        />
                    </View>
                ) : allPlugins.length ? (
                    <View>
                        <Pressable
                            style={styles.backBtn}
                            onPress={() => {
                                setMode("input");
                                setQuery("");
                            }}>
                            <Icon
                                name="arrow-left"
                                size={iconSizeConst.normal}
                                color={colors.textSecondary}
                            />
                            <ThemeText
                                fontSize="normal"
                                fontColor="textSecondary">
                                {t("panel.importMusicSheet.backToInput")}
                            </ThemeText>
                        </Pressable>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.hint}>
                            {t("panel.importMusicSheet.chooseSource")}
                        </ThemeText>
                        {allPlugins.map((plugin, i, arr) => (
                            <View key={plugin.hash}>
                                <ListItem
                                    withHorizontalPadding
                                    heightType="small"
                                    onPress={() => {
                                        setSelectedPlugin(plugin);
                                        setMode("plugin-input");
                                        setQuery("");
                                    }}>
                                    <ListItem.Content
                                        title={plugin.name}
                                    />
                                </ListItem>
                                {/* 2026-10-21 统一：列表项之间加 ListDivider */}
                                {i < arr.length - 1 ? (
                                    <ListDivider marginLeft={16} />
                                ) : null}
                            </View>
                        ))}
                    </View>
                ) : (
                    <ThemeText
                        fontSize="content"
                        fontColor="textSecondary">
                        {t("panel.importMusicSheet.chooseSource")}（无可用音源）
                    </ThemeText>
                )}
            </Dialog.Content>
            <Dialog.Actions actions={renderActions()} />
        </Dialog>
    );
}
const styles = StyleSheet.create({
    input: {
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: "rgba(128,128,128,0.08)",
    },
    hint: {
        marginTop: 12,
    },
    backBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        paddingVertical: 4,
        marginBottom: 4,
    },
});
