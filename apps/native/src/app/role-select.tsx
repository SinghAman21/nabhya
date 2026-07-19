import { useRouter } from "expo-router";
import { HandHeart, Landmark } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useTheme } from "@/hooks/useTheme";
import { type UserRole, useAuthStore } from "@/store/auth-store";

export default function RoleSelect() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const setRole = useAuthStore((s) => s.setRole);

	const choose = (role: UserRole) => {
		setRole(role);
		router.replace("/");
	};

	const cards: Array<{
		role: UserRole;
		title: string;
		description: string;
		Icon: typeof Landmark;
	}> = [
		{
			role: "ngo",
			title: "I'm an NGO",
			description:
				"Register your organization, post needs, and manage volunteers and events.",
			Icon: Landmark,
		},
		{
			role: "volunteer",
			title: "I'm a Volunteer",
			description: "Discover NGOs near you, donate items, and help at events.",
			Icon: HandHeart,
		},
	];

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				padding: spacing[6],
				justifyContent: "center",
			}}
		>
			<H2 style={{ marginBottom: spacing[1] }}>How will you use Nabhya?</H2>
			<Body color="secondary" style={{ marginBottom: spacing[6] }}>
				You can change this later in your profile.
			</Body>

			{cards.map(({ role, title, description, Icon }) => (
				<Pressable
					key={role}
					onPress={() => choose(role)}
					style={({ pressed }) => ({
						backgroundColor: colors.background.primary,
						borderRadius: 20,
						padding: spacing[5],
						borderWidth: 1,
						borderColor: pressed ? colors.primary.main : colors.border.light,
						marginBottom: spacing[4],
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[4],
					})}
				>
					<View
						style={{
							width: 48,
							height: 48,
							borderRadius: 24,
							backgroundColor: colors.primary.main,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon size={24} color={colors.primary.contrast as string} />
					</View>
					<View style={{ flex: 1 }}>
						<Body weight="bold">{title}</Body>
						<Caption color="secondary">{description}</Caption>
					</View>
				</Pressable>
			))}
		</View>
	);
}
