import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

// 更新源：gitee 公共仓库 xunwulove/jiyuejie（个人项目，软件更新 + 音源订阅同仓；原 jiyuejie-updates 已改名）。
// 【固定更新链路】不绑版本 tag：
// 1. 主地址：固定 tag `latest` 的 release 附件直链（无 UA 限制，实测 200）。
// 2. 兜底地址：仓库 updates/version.json（gitee raw 有反爬，真机 axios 带设备 UA 可能被拦，仅作兜底）。
// 【发版流程（每次发版）】：
//   a. APK 附件必须上传到【唯一版本 tag】的 release（如 v0.6.2.15），不要只放 latest——latest 的 APK 直链是固定 URL，
//      同名附件会被 CDN 缓存成旧包，用户下载命中旧版导致系统提示”已安装同版本”。version.json 附件可放 latest（内容更新能命中）。
//   b. version.json 中 version 改为新版本号、changeLog 更新；download 数组指向【唯一 tag】的两个 APK 直链
//      （如 https://gitee.com/xunwulove/jiyuejie/releases/download/v0.6.2.15/app-arm64-v8a-release.apk）。
//   c. latest release 也上传一份 version.json（download 同样指向唯一 tag URL），保证主地址 latest/version.json 读到的 download 正确。
//   d. 无需改任何代码，app 下次点”检查更新”即命中新版本。
const updateList = [
    "https://gitee.com/xunwulove/jiyuejie/releases/download/latest/version.json",
    "https://gitee.com/xunwulove/jiyuejie/raw/master/updates/version.json",
];

interface IUpdateInfo {
    needUpdate: boolean;
    data: {
        version: string;
        changeLog: string[];
        download: string[];
    };
}

export default async function checkUpdate(): Promise<IUpdateInfo | undefined> {
    const currentVersion = DeviceInfo.getVersion();
    for (let i = 0; i < updateList.length; ++i) {
        try {
            const rawInfo = (await axios.get(updateList[i])).data;
            if (compare(rawInfo.version, currentVersion, ">")) {
                return {
                    needUpdate: true,
                    data: rawInfo,
                };
            }
        } catch {}
    }
}
