/**
 * Build variants on top of app.json.
 *
 *   APP_VARIANT=development  "UniOS Dev"  com.anonymous.UniOS.dev  (dev client, loads code from Metro)
 *   APP_VARIANT=preview      "UniOS"      com.anonymous.UniOS      (standalone APK, the one you use daily)
 *   (unset)                  production, same id as preview
 *
 * The dev app has its own package id, so it installs next to the real app and
 * never touches its data or signing key. Set by the profiles in eas.json.
 */
const VARIANT = process.env.APP_VARIANT || 'production';
const IS_DEV = VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'UniOS Dev' : config.name,
  scheme: IS_DEV ? 'unios-dev' : config.scheme,
  android: {
    ...config.android,
    package: IS_DEV ? `${config.android.package}.dev` : config.android.package,
  },
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.anonymous.UniOS.dev' : config.ios?.bundleIdentifier,
  },
  extra: {
    ...config.extra,
    appVariant: VARIANT,
  },
});
