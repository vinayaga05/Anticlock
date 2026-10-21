/**
 * Autolinking installs the default Apple Maps subspec. We take Google Maps
 * instead via Podfile (`react-native-maps/Google`).
 */
module.exports = {
  dependencies: {
    'react-native-maps': {
      platforms: {
        ios: null,
      },
    },
  },
};
