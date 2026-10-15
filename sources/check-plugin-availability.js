#!/usr/bin/env node
/**
 * 极悦界音源插件可用性检测脚本
 *
 * 基于 MusicFree 源码的插件加载逻辑（src/core/pluginManager/plugin.ts），
 * 在 Node.js 沙箱中真实加载每个插件并执行搜索测试，判断音源是否实际可用。
 *
 * 用法：
 *   node check-plugin-availability.js [--subscription=URL] [--query=周杰伦] [--concurrency=5] [--timeout=10000]
 *
 * 输出：
 *   - 控制台打印汇总报告
 *   - plugin-availability-report.json（详细结果）
 *
 * 注意：URL 可下载 ≠ 音源可用。本脚本实际执行 search() 验证返回结果。
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ========== 配置 ==========
const args = process.argv.slice(2).reduce((acc, cur) => {
    const [k, v] = cur.replace(/^--/, "").split("=");
    acc[k] = v || true;
    return acc;
}, {});

const SUBSCRIPTION_URL = args.subscription ||
    "https://gitee.com/xunwulove/jiyuejie/raw/master/sources/plugins.json";
const SEARCH_QUERY = args.query || "周杰伦";
const CONCURRENCY = parseInt(args.concurrency) || 5;
const SEARCH_TIMEOUT = parseInt(args.timeout) || 10000;
const DOWNLOAD_TIMEOUT = 12000;
const RESULT_FILE = path.join(__dirname, "plugin-availability-report.json");

// ========== 全局异常捕获（插件内部逃逸的异步异常不影响整体） ==========
process.on("unhandledRejection", () => {});
process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err.message);
});

// ========== 依赖加载（与 MusicFree 源码一致） ==========
function loadDep(name) {
    try { return require(name); } catch (e) { return null; }
}
// 优先从项目 node_modules 加载，回退到全局
const PROJECT_CANDIDATES = [
    path.join(__dirname, "..", "node_modules"),
    "E:\\xunwu\\deepseek\\jiyuejie\\node_modules",
];
function requireFromProject(name) {
    for (const dir of PROJECT_CANDIDATES) {
        try { return require(path.join(dir, name)); } catch (e) {}
    }
    return require(name);
}

let axios, cheerio, CryptoJs, dayjs, bigInt, qs, he;
try {
    axios = requireFromProject("axios").default || requireFromProject("axios");
    cheerio = requireFromProject("cheerio").default || requireFromProject("cheerio");
    CryptoJs = requireFromProject("crypto-js");
    dayjs = requireFromProject("dayjs");
    bigInt = requireFromProject("big-integer");
    qs = requireFromProject("qs");
    he = requireFromProject("he");
} catch (e) {
    console.error("依赖加载失败，请先 npm install axios cheerio crypto-js dayjs big-integer qs he");
    console.error(e.message);
    process.exit(1);
}

axios.defaults.timeout = 8000;
axios.defaults.headers.common["User-Agent"] =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 与 MusicFree 源码一致的 packages 映射
const packages = {
    cheerio,
    "crypto-js": CryptoJs,
    axios,
    dayjs,
    "big-integer": bigInt,
    qs,
    he,
    "@react-native-cookies/cookies": { get: () => {}, set: () => {}, flush: () => {} },
    webdav: { createClient: () => ({}) },
};
const _require = (packageName) => {
    let pkg = packages[packageName];
    if (!pkg) throw new Error("module not found: " + packageName);
    pkg.default = pkg;
    return pkg;
};
const _console = { log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

// ========== 工具函数 ==========
function download(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith("https") ? https : http;
        const req = lib.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: DOWNLOAD_TIMEOUT,
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return download(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error("HTTP " + res.statusCode));
            }
            let data = "";
            res.setEncoding("utf-8");
            res.on("data", (c) => (data += c));
            res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("download timeout")); });
    });
}

/**
 * 与 MusicFree 源码 mountPlugin() 完全一致的插件加载方式
 * env 含 getUserVariables（测试环境返回空对象）
 */
function loadPlugin(code) {
    const _module = { exports: {} };
    const env = {
        getUserVariables: () => ({}),
        get userVariables() { return this.getUserVariables() || {}; },
        appVersion: "0.6.2.14",
        os: "android",
        lang: "zh-CN",
    };
    const _process = { platform: "android", version: "0.6.2.14", env };
    // eslint-disable-next-line no-new-func
    const fn = new Function(
        "'use strict'; return function(require, __musicfree_require, module, exports, console, env, URL, process) {\n" +
        code + "\n}"
    );
    fn()(_require, _require, _module, _module.exports, _console, env, URL, _process);
    const instance = _module.exports.default || _module.exports;
    // 过滤无效 userVariables
    if (Array.isArray(instance.userVariables)) {
        instance.userVariables = instance.userVariables.filter((it) => it && it.key);
    }
    return instance;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ========== 单插件测试 ==========
async function testPlugin(plugin) {
    const result = {
        name: plugin.name,
        url: plugin.url,
        version: plugin.version || "",
        loadOk: false,
        platform: "",
        hasSearch: false,
        hasGetMediaSource: false,
        hasLyric: false,
        // 歌单/榜单能力
        hasTopLists: false,
        hasRecommendSheetTags: false,
        hasRecommendSheets: false,
        hasMusicSheetInfo: false,
        topListsOk: false,
        topListsCount: 0,
        recommendSheetsOk: false,
        recommendSheetsCount: 0,
        needsVars: "",
        searchOk: false,
        searchCount: 0,
        firstResult: "",
        error: "",
        sheetError: "",
    };

    try {
        const code = await download(plugin.url);
        result.codeSize = code.length;
        const instance = loadPlugin(code);
        result.loadOk = true;
        result.platform = instance.platform || plugin.name;
        result.hasSearch = typeof instance.search === "function";
        result.hasGetMediaSource = typeof instance.getMediaSource === "function";
        result.hasLyric = typeof instance.getLyric === "function";
        result.hasTopLists = typeof instance.getTopLists === "function";
        result.hasRecommendSheetTags = typeof instance.getRecommendSheetTags === "function";
        result.hasRecommendSheets = typeof instance.getRecommendSheetsByTag === "function";
        result.hasMusicSheetInfo = typeof instance.getMusicSheetInfo === "function";
        if (instance.userVariables && instance.userVariables.length > 0) {
            result.needsVars = instance.userVariables.map((v) => v.key).join(",");
        }

        // 1. 搜索检测
        if (result.hasSearch) {
            try {
                const r = await Promise.race([
                    Promise.resolve().then(() => instance.search(SEARCH_QUERY, 1, "music")),
                    new Promise((_, rej) =>
                        setTimeout(() => rej(new Error("search timeout")), SEARCH_TIMEOUT)
                    ),
                ]);
                if (r && r.data && r.data.length > 0) {
                    result.searchOk = true;
                    result.searchCount = r.data.length;
                    const first = r.data[0];
                    result.firstResult = (first.title || first.name || "").toString().substring(0, 50);
                } else {
                    result.error = "search returned empty";
                }
            } catch (e) {
                result.error = "search failed: " + (e.message || String(e)).substring(0, 100);
            }
        } else {
            result.error = "no search function";
        }

        // 2. 榜单检测（有 getTopLists 则实际调用）
        if (result.hasTopLists) {
            try {
                const r = await Promise.race([
                    Promise.resolve().then(() => instance.getTopLists()),
                    new Promise((_, rej) =>
                        setTimeout(() => rej(new Error("topLists timeout")), SEARCH_TIMEOUT)
                    ),
                ]);
                if (Array.isArray(r) && r.length > 0) {
                    // r 是 IMusicSheetGroupItem[]，每组含 title + data
                    const total = r.reduce((sum, g) => sum + (g.data ? g.data.length : 0), 0);
                    if (total > 0) {
                        result.topListsOk = true;
                        result.topListsCount = total;
                    } else {
                        result.sheetError = "topLists returned empty groups";
                    }
                } else {
                    result.sheetError = "topLists returned empty";
                }
            } catch (e) {
                result.sheetError = "topLists failed: " + (e.message || String(e)).substring(0, 80);
            }
        }

        // 3. 推荐歌单检测（有 getRecommendSheetTags + getRecommendSheetsByTag 则实际调用）
        if (result.hasRecommendSheetTags && result.hasRecommendSheets) {
            try {
                const tags = await Promise.race([
                    Promise.resolve().then(() => instance.getRecommendSheetTags()),
                    new Promise((_, rej) =>
                        setTimeout(() => rej(new Error("sheetTags timeout")), SEARCH_TIMEOUT)
                    ),
                ]);
                // 取第一个可用 tag
                let firstTag = null;
                if (tags && tags.pinned && tags.pinned.length > 0) {
                    firstTag = tags.pinned[0];
                } else if (tags && tags.data && tags.data.length > 0) {
                    const group = tags.data.find((g) => g.data && g.data.length > 0);
                    if (group) firstTag = group.data[0];
                }
                if (firstTag) {
                    const sheets = await Promise.race([
                        Promise.resolve().then(() => instance.getRecommendSheetsByTag(firstTag, 1)),
                        new Promise((_, rej) =>
                            setTimeout(() => rej(new Error("sheetsByTag timeout")), SEARCH_TIMEOUT)
                        ),
                    ]);
                    if (sheets && sheets.data && sheets.data.length > 0) {
                        result.recommendSheetsOk = true;
                        result.recommendSheetsCount = sheets.data.length;
                    } else {
                        result.sheetError = (result.sheetError ? result.sheetError + "; " : "") + "recommendSheets returned empty";
                    }
                } else {
                    result.sheetError = (result.sheetError ? result.sheetError + "; " : "") + "no recommend sheet tag";
                }
            } catch (e) {
                result.sheetError = (result.sheetError ? result.sheetError + "; " : "") +
                    "recommendSheets failed: " + (e.message || String(e)).substring(0, 80);
            }
        }
    } catch (e) {
        result.error = "load failed: " + (e.message || String(e)).substring(0, 100);
    }
    return result;
}

// ========== 主流程 ==========
async function main() {
    console.log("========================================");
    console.log("  极悦界音源插件可用性检测");
    console.log("========================================");
    console.log("订阅源:", SUBSCRIPTION_URL);
    console.log("搜索词:", SEARCH_QUERY);
    console.log("并发数:", CONCURRENCY);
    console.log("搜索超时:", SEARCH_TIMEOUT + "ms");
    console.log("注意: URL可下载 ≠ 音源可用，本脚本实际执行 search() 验证\n");

    // 加载增量结果
    let results = [];
    if (fs.existsSync(RESULT_FILE)) {
        try {
            results = JSON.parse(fs.readFileSync(RESULT_FILE, "utf-8"));
            console.log("续检: 已有 " + results.length + " 条结果\n");
        } catch (e) { results = []; }
    }
    const tested = new Set(results.map((r) => r.name));

    // 下载订阅源
    console.log("下载音源订阅源...");
    let plugins;
    try {
        const subJson = await download(SUBSCRIPTION_URL);
        const sub = JSON.parse(subJson);
        plugins = sub.plugins || [];
        console.log("订阅源含 " + plugins.length + " 个插件\n");
    } catch (e) {
        console.error("订阅源下载失败:", e.message);
        process.exit(1);
    }

    const pending = plugins.filter((p) => !tested.has(p.name));
    console.log("待检测: " + pending.length + " 个\n");

    // 并发检测
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(async (p) => {
                const r = await testPlugin(p);
                process.stdout.write(r.searchOk ? "✓" : (r.loadOk ? "○" : "✗"));
                return r;
            })
        );
        results.push(...batchResults);
        fs.writeFileSync(RESULT_FILE, JSON.stringify(results, null, 2), "utf-8");
        console.log("  " + results.length + "/" + plugins.length);
        await sleep(200);
    }

    // ========== 汇总报告 ==========
    const loadOk = results.filter((r) => r.loadOk).length;
    const hasSearch = results.filter((r) => r.hasSearch).length;
    const searchOk = results.filter((r) => r.searchOk).length;
    const needsVars = results.filter((r) => r.needsVars).length;
    const searchFailed = results.filter((r) => !r.searchOk);
    const hasTopLists = results.filter((r) => r.hasTopLists).length;
    const topListsOk = results.filter((r) => r.topListsOk).length;
    const hasRecommendSheets = results.filter((r) => r.hasRecommendSheetTags && r.hasRecommendSheets).length;
    const recommendSheetsOk = results.filter((r) => r.recommendSheetsOk).length;
    const sheetFailed = results.filter((r) => (r.hasTopLists || (r.hasRecommendSheetTags && r.hasRecommendSheets)) && !r.topListsOk && !r.recommendSheetsOk);

    console.log("\n========================================");
    console.log("  检测结果汇总");
    console.log("========================================");
    console.log("插件总数:        " + results.length);
    console.log("加载成功:        " + loadOk + "/" + results.length);
    console.log("含 search 函数:  " + hasSearch);
    console.log("含 getMediaSource:" + results.filter((r) => r.hasGetMediaSource).length);
    console.log("搜索实际可用:    " + searchOk + "/" + results.length + " (" + (searchOk / results.length * 100).toFixed(1) + "%)");
    console.log("--- 歌单/榜单 ---");
    console.log("含 getTopLists:  " + hasTopLists + "，榜单可用: " + topListsOk);
    console.log("含推荐歌单能力:  " + hasRecommendSheets + "，推荐歌单可用: " + recommendSheetsOk);
    console.log("需要用户变量:    " + needsVars);

    console.log("\n--- 搜索不可用插件 (" + searchFailed.length + ") ---");
    searchFailed.forEach((r) => {
        const tag = r.loadOk ? "[加载OK]" : "[加载失败]";
        console.log("  " + tag + " " + r.name + " | " + r.error);
    });

    if (sheetFailed.length > 0) {
        console.log("\n--- 歌单/榜单不可用插件 (" + sheetFailed.length + ") ---");
        sheetFailed.forEach((r) => {
            const parts = [];
            if (r.hasTopLists) parts.push("榜单:" + (r.topListsOk ? "OK("+r.topListsCount+")" : "失败"));
            if (r.hasRecommendSheetTags && r.hasRecommendSheets) parts.push("推荐歌单:" + (r.recommendSheetsOk ? "OK("+r.recommendSheetsCount+")" : "失败"));
            console.log("  " + r.name + " | " + parts.join(" | ") + (r.sheetError ? " | " + r.sheetError : ""));
        });
    }

    if (needsVars > 0) {
        console.log("\n--- 需要用户变量(cookie/key等)的插件 (" + needsVars + ") ---");
        results.filter((r) => r.needsVars).forEach((r) => {
            console.log("  " + r.name + " -> [" + r.needsVars + "] 搜索: " +
                (r.searchOk ? "OK(" + r.searchCount + "条)" : "失败") +
                (r.hasTopLists ? " 榜单:" + (r.topListsOk ? "OK" : "失败") : ""));
        });
    }

    console.log("\n详细报告: " + RESULT_FILE);
    console.log("========================================");
}

main().catch((e) => {
    console.error("FATAL:", e.message);
    process.exit(1);
});
