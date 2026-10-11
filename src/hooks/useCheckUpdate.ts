import { showDialog } from "@/components/dialogs/useDialog";
import PersistStatus from "@/utils/persistStatus";
import checkUpdate from "@/utils/checkUpdate";
import Toast from "@/utils/toast";
import { compare } from "compare-versions";
import { useEffect } from "react";
import i18n from "@/core/i18n";

export const checkUpdateAndShowResult = (
    showToast = false,
    checkSkip = false,
) => {
    checkUpdate().then(updateInfo => {
        if (updateInfo?.needUpdate) {
            const { data } = updateInfo;
            const skipVersion = PersistStatus.get("app.skipVersion");
            if (
                checkSkip &&
                skipVersion &&
                compare(skipVersion, data.version, ">=")
            ) {
                return;
            }
            showDialog("DownloadDialog", {
                version: data.version,
                content: data.changeLog,
                fromUrl: data.download[0],
                backUrl: data.download[1],
            });
        } else {
            if (showToast) {
                Toast.success(i18n.t("checkUpdate.error.latestVersion"));
            }
        }
    });
};

export default function (callOnMount = true) {
    useEffect(() => {
        if (callOnMount) {
            // 自动检查路径做每日节流：距上次自动检查不足 24h 则跳过，
            // 避免每次冷启动都发网络请求（手动入口不受节流影响）
            const lastCheckTime =
                PersistStatus.get("app.lastUpdateCheckTime") ?? 0;
            if (Date.now() - lastCheckTime < 24 * 60 * 60 * 1000) {
                return;
            }
            PersistStatus.set("app.lastUpdateCheckTime", Date.now());
            checkUpdateAndShowResult(false, true);
        }
    }, []);

    return checkUpdateAndShowResult;
}
