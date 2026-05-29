module.exports = function (api) {
    api.cache(true)
    return {
        presets: ["babel-preset-expo"],
        plugins: [
            [
                "react-native-reanimated/plugin",
                {
                    processNestedWorklets: true,
                    globals: ["__ENABLE_SHARED_ELEMENT_TRANSITIONS"],
                },
            ],
        ],
    }
}
