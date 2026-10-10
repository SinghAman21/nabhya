import type { ViewStyle } from "react-native";

/**
 * The width a list or form page reads at, passed as `<Screen style>`.
 *
 * The shared screens sit inside `TopBarContent`, which caps at 1180 for the
 * feed's sake - so a list of NGO rows, a timeline or a five-field form drew
 * 1180 wide on a laptop: a status pill a hand-span from the title it belongs
 * to, and a text field you read with your head turning. 720 is the reading
 * column `WebContent` and the detail pages (`events/[id]`, `needs/[id]`)
 * already use. On a phone the cap never binds.
 */
export const READING_COLUMN: ViewStyle = {
	width: "100%",
	maxWidth: 720,
	alignSelf: "center",
};
