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
    },
    // 2026-10-14（打包临时）：Metro 在 Windows 上 file watcher/healthCheck 已知卡死
    // （"Starting Metro Bundler" 后挂起、CPU 归零），禁用 watchman 与 healthCheck 规避。
    // 打包完成后如不再需要可还原（备份：E:\Temp\Deepseek\jiyuejie-metro-config-backup-20261014.js）
    watcher: {
        watchman: { enabled: false },
        healthCheck: { enabled: false },
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
