const { withAndroidManifest } = require("expo/config-plugins")

/**
 * Config plugin to enable cleartext (HTTP) traffic on Android
 */
function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults

    const application = androidManifest.manifest.application?.[0]
    if (application) {
      application.$["android:usesCleartextTraffic"] = "true"
    }

    return config
  })
}

module.exports = withCleartextTraffic
