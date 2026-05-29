const { withGradleProperties } = require("expo/config-plugins")

const REACT_NATIVE_ARCHITECTURES = "arm64-v8a,armeabi-v7a"

function withAndroidReactNativeArchitectures(config) {
    return withGradleProperties(config, config => {
        const existingProperty = config.modResults.find(property => property.type === "property" && property.key === "reactNativeArchitectures")

        if (existingProperty) {
            existingProperty.value = REACT_NATIVE_ARCHITECTURES
            return config
        }

        config.modResults.push({
            type: "property",
            key: "reactNativeArchitectures",
            value: REACT_NATIVE_ARCHITECTURES,
        })

        return config
    })
}

module.exports = withAndroidReactNativeArchitectures