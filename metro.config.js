const {getDefaultConfig} = require('expo/metro-config');
const {mergeConfig} = require('@react-native/metro-config');

/**
 * Reference: https://github.com/software-mansion/react-native-svg/blob/main/USAGE.md
 */
const defaultConfig = getDefaultConfig(__dirname);
const {assetExts, sourceExts} = defaultConfig.resolver;
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    transformer: {
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
    },
    resolver: {
        assetExts: assetExts.filter(ext => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],
        // 2026-10-28 修正：Metro 禁用 watchman 的正确键是 resolver.useWatchman
        // （metro/src/node-haste/DependencyGraph/createFileMap.js: useWatchman:
        // config.resolver.useWatchman）。旧写法 watcher.useWatchman /
        // watcher.watchman.enabled 均报 "Unknown option" 且不生效，导致
        // Windows 上 Metro 仍走 watchman、bundle 卡死在 97%。
        useWatchman: false,
        // 2026-10-28 追加：tools/ 已并入主仓库（source-probe 是独立 RN 工程，
        // 自带 node_modules 约 12.6 万文件 + verify_sources 脚本），Metro 构建
        // 文件地图会全量扫描导致 bundle 极慢/停滞。排除 tools/ 下两个子目录，
        // 主项目 src 不引用它们。
        blockList: [
            /^.*[\\/]tools[\\/]source-probe[\\/].*/,
            /^.*[\\/]tools[\\/]verify_sources[\\/].*/,
        ],
    },
    watcher: {
        healthCheck: { enabled: false },
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
