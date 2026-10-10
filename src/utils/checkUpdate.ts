import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

// 更新源：gitee 公共仓库 xunwulove/jiyuejie-updates（个人项目，只放更新包）。
// 【固定更新链路】不绑版本 tag：
// 1. 主地址：固定 tag `latest` 的 release 附件直链（无 UA 限制，实测 200）。
// 2. 兜底地址：仓库 master 根目录 version.json（gitee raw 有反爬，真机 axios 带设备 UA 可能被拦，仅作兜底）。
// 【发版流程（每次发版）】：
//   a. 删除 gitee 仓库旧 tag `latest` 的 release（重建同名 tag），上传新 version.json + 新 APK 附件（文件名必须保持
//      version.json / app-arm64-v8a-release.apk / app-universal-release.apk 不变，链接才固定）；
//   b. version.json 中 version 改为新版本号、changeLog 更新、download 仍指向 latest tag 的两个 APK 直链；
//   c. 无需改任何代码，app 下次点“检查更新”即命中新版本。
const updateList = [
    "https://gitee.com/xunwulove/jiyuejie-updates/releases/download/latest/version.json",
    "https://gitee.com/xunwulove/jiyuejie-updates/raw/master/version.json",
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
