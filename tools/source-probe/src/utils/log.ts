import { fileAsyncTransport, logger } from "react-native-logs";
import RNFS from "react-native-fs";
import pathConst from "@/constants/pathConst";

const config = {
    transport: fileAsyncTransport,
    transportOptions: {
        FS: RNFS,
        filePath: pathConst.logPath,
        fileName: "error-log-{date-today}.log",
    },
    dateFormat: "local",
};

const log = logger.createLogger(config);

/** 操作路径记录：仅开发模式控制台输出（生产零开销） */
export function trace(
    desc: string,
    message?: any,
    _level?: "info" | "error",
) {
    if (__DEV__) {
        console.log(desc, message);
    }
}

/** 错误日志：始终写入错误日志文件（供排障），不依赖任何设置开关 */
export function errorLog(desc: string, message: any) {
    log.error({
        desc,
        message,
    });
}

/**
 * 开发调试面板（VDebug）已整体移除；保留空实现以兼容既有调用点。
 */
export function devLog(
    _method: "log" | "error" | "warn" | "info",
    ..._args: any[]
) {}

export { log };
