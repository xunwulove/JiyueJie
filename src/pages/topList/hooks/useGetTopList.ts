import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { getCachedTopLists } from "@/core/topListCache";
import { produce } from "immer";
import { useAtom } from "jotai";
import { useCallback } from "react";
import { pluginsTopListAtom } from "../store/atoms";

export default function useGetTopList() {
    const [pluginsTopList, setPluginsTopList] = useAtom(pluginsTopListAtom);

    const getTopList = useCallback(
        async (pluginHash: string) => {
            try {
                // 内存已有数据/加载中 → 直接返回（进程内不重复请求）
                if (
                    pluginsTopList[pluginHash]?.data?.length ||
                    pluginsTopList[pluginHash]?.state ===
                        RequestStateCode.PENDING_REST_PAGE
                ) {
                    return;
                }
                // 获取plugin
                const plugin = PluginManager.getByHash(pluginHash);
                if (!plugin) {
                    return;
                }

                setPluginsTopList(
                    produce(draft => {
                        draft[pluginHash] = {
                            state: RequestStateCode.PENDING_REST_PAGE,
                            data: [],
                        };
                    }),
                );

                // 每日持久缓存优先（Plugin.TopListCache，仿照推荐歌单）：
                // 当天缓存命中直接显示；跨天拉取 getTopLists 并覆盖缓存；失败回退上一次缓存
                const cached = await getCachedTopLists(pluginHash);
                if (cached?.length) {
                    setPluginsTopList(
                        produce(draft => {
                            draft[pluginHash] = {
                                data: cached,
                                state: RequestStateCode.FINISHED,
                            };
                        }),
                    );
                    return;
                }

                // 无任何可用数据（拉取失败且无缓存回退）
                setPluginsTopList(
                    produce(draft => {
                        draft[pluginHash].state = RequestStateCode.ERROR;
                    }),
                );
            } catch {
                setPluginsTopList(
                    produce(draft => {
                        draft[pluginHash].state = RequestStateCode.ERROR;
                    }),
                );
            }
        },
        [pluginsTopList],
    );

    return getTopList;
}
