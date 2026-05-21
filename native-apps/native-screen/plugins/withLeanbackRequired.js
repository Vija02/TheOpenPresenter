const { withAndroidManifest } = require("expo/config-plugins")

/**
 * Config plugin that finalizes the TV uses-feature declarations:
 *   - android.software.leanback        required="true"  (TV-only)
 *   - android.hardware.touchscreen     required="false"
 *   - android.hardware.faketouch       required="false"
 *
 * Runs after @react-native-tvos/config-tv and is idempotent.
 */
function withLeanbackRequired(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest

    manifest["uses-feature"] = manifest["uses-feature"] || []

    const desired = [
      { name: "android.software.leanback", required: "true" },
      { name: "android.hardware.touchscreen", required: "false" },
      { name: "android.hardware.faketouch", required: "false" },
    ]

    for (const { name, required } of desired) {
      const existing = manifest["uses-feature"].find(
        (f) => f.$?.["android:name"] === name,
      )
      if (existing) {
        existing.$["android:required"] = required
      } else {
        manifest["uses-feature"].push({
          $: { "android:name": name, "android:required": required },
        })
      }
    }

    return config
  })
}

module.exports = withLeanbackRequired
