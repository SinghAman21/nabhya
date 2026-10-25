import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/hooks/use-theme";

/**
 * A QR code for `value`, drawn as one SVG path - the same encoder the server
 * uses for the certificate PDF, so the code on screen and on paper match.
 *
 * Always dark modules on a white tile, in both schemes: a QR is read by a
 * camera, and inverted (light-on-dark) codes fail on many scanners. The tile
 * carries a quiet zone of two modules, which the spec requires.
 *
 * The accessibility label sits on the wrapping View, never on the `Svg` -
 * react-native-svg forwards props to the DOM `<svg>` on the web.
 */
export function QrCode({
	value,
	size = 160,
	label,
}: {
	value: string;
	size?: number;
	/** Spoken description; the code itself is meaningless read aloud. */
	label: string;
}) {
	const { borderRadius } = useTheme();
	const { path, modules } = useMemo(() => {
		const qr = qrcode(0, "M");
		qr.addData(value);
		qr.make();
		const count = qr.getModuleCount();
		let d = "";
		for (let row = 0; row < count; row++) {
			for (let col = 0; col < count; col++) {
				if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
			}
		}
		return { path: d, modules: count };
	}, [value]);

	const quiet = 2;
	const box = modules + quiet * 2;

	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={label}
			style={{
				width: size,
				height: size,
				backgroundColor: "#FFFFFF",
				borderRadius: borderRadius.md,
				overflow: "hidden",
			}}
		>
			<Svg
				width={size}
				height={size}
				viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
			>
				<Path d={path} fill="#111111" />
			</Svg>
		</View>
	);
}
