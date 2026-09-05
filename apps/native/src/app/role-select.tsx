import type { SelectableRole } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { HandHeart, Landmark } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useSelectRole } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";

export default function RoleSelect() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const selectRole = useSelectRole();

	const choose = (role: SelectableRole) => {
		if (selectRole.isPending) return;
		selectRole.mutate(role, {
			onSuccess: () => router.replace("/"),
			onError: (error) =>
				Alert.alert("Could not set role", apiErrorMessage(error)),
		});
	};

	const cards: Array<{
		role: SelectableRole;
		title: string;
		description: string;
		Icon: typeof Landmark;
	}> = [
		{
			role: "organisation",
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
				This sets up your account — contact support if you need it changed
				later.
			</Body>

			{cards.map(({ role, title, description, Icon }) => {
				const isPending = selectRole.isPending && selectRole.variables === role;

				return (
					<Pressable
						key={role}
						onPress={() => choose(role)}
						disabled={selectRole.isPending}
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
							opacity: selectRole.isPending && !isPending ? 0.5 : 1,
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
							{isPending ? (
								<ActivityIndicator
									size="small"
									color={colors.primary.contrast as string}
								/>
							) : (
								<Icon size={24} color={colors.primary.contrast as string} />
							)}
						</View>
						<View style={{ flex: 1 }}>
							<Body weight="bold">{title}</Body>
							<Caption color="secondary">{description}</Caption>
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}
