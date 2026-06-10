/**
 * React Native Configuration for Custom Fonts
 *
 * This configuration ensures proper font linking for both iOS and Android.
 * Especially important for variable fonts on Android which need explicit weight mappings.
 */

module.exports = {
	project: {
		ios: {
			sourceDir: "./ios",
		},
		android: {
			sourceDir: "./android",
		},
	},
	assets: ["./assets/fonts/"],
};
