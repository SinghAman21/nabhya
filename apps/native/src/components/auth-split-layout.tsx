import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { Body, Caption, H1 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/use-theme";

const BREAKPOINT = 768;
const BRAND_BG = "#0A0A0A";

interface AuthSplitLayoutProps {
	children: ReactNode;
	alternateLink: ReactNode;
}

export function AuthSplitLayout({
	children,
	alternateLink,
}: AuthSplitLayoutProps) {
	const { width } = useWindowDimensions();
	const { colors, spacing } = useTheme();
	const isWide = width >= BREAKPOINT;

	if (isWide) {
		return (
			<View style={{ flex: 1, flexDirection: "row" }}>
				<View
					style={{
						flex: 1,
						backgroundColor: BRAND_BG,
						justifyContent: "center",
						padding: spacing[16],
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[3],
							marginBottom: spacing[4],
						}}
					>
						<H1 color="#FFFFFF" style={{ letterSpacing: 3 }}>
							NABHYA
						</H1>
					</View>
					<Body color="#A3A3A3" style={{ maxWidth: 320 }}>
						Your organization's hub for impact. Manage volunteers, track
						donations, and coordinate relief - all in one place.
					</Body>

					<View
						style={{
							height: 1,
							backgroundColor: "#222222",
							marginTop: spacing[10],
						}}
					/>

					<Caption color="#555555" style={{ marginTop: spacing[4] }}>
						Built for NGOs • by NeGrOs
					</Caption>
				</View>

				<View
					style={{
						flex: 1,
						backgroundColor: colors.background.primary,
						justifyContent: "center",
						alignItems: "center",
						padding: spacing[12],
					}}
				>
					<View style={{ width: "100%", maxWidth: 400 }}>
						{children}
						{alternateLink && (
							<View
								style={{
									borderTopWidth: 1,
									borderTopColor: colors.border.light,
									marginTop: spacing[6],
									paddingTop: spacing[5],
									alignItems: "center",
								}}
							>
								{alternateLink}
							</View>
						)}
					</View>
				</View>
			</View>
		);
	}

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.primary }}>
			<View
				style={{
					backgroundColor: BRAND_BG,
					paddingHorizontal: spacing[5],
					paddingTop: spacing[10],
					paddingBottom: spacing[5],
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					<View
						style={{
							width: 2,
							height: 12,
							backgroundColor: colors.primary.main,
						}}
					/>
					<Body
						weight="bold"
						color="#FFFFFF"
						style={{ letterSpacing: 2, fontSize: 14 }}
					>
						NABHYA
					</Body>
				</View>
			</View>

			<View
				style={{
					flex: 1,
					padding: spacing[6],
					justifyContent: "center",
				}}
			>
				{children}
				{alternateLink && (
					<View
						style={{
							borderTopWidth: 1,
							borderTopColor: colors.border.light,
							marginTop: spacing[6],
							paddingTop: spacing[5],
							alignItems: "center",
						}}
					>
						{alternateLink}
					</View>
				)}
			</View>
		</View>
	);
}
