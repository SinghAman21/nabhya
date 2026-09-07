import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { withAppShell } from "@/components/app-shell";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, Label } from "@/components/ui/typography";
import { useMe, useUpdateProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The volunteer's own details. Saves straight back to the profile and returns;
 * a success alert on top of a screen that has already changed is one tap too
 * many, so there isn't one.
 */
function EditProfile() {
	const { spacing } = useTheme();
	const router = useRouter();

	const me = useMe();
	const update = useUpdateProfile();

	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [bio, setBio] = useState("");
	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!me.data) return;
		setFullName(me.data.name ?? "");
		setPhone(me.data.phone ?? "");
		setBio(me.data.bio ?? "");
		setCity(me.data.city ?? "");
		setState(me.data.state ?? "");
	}, [me.data]);

	const save = () => {
		setError(null);
		update.mutate(
			{
				fullName: fullName.trim() || undefined,
				phone: phone.trim() || undefined,
				bio: bio.trim() || undefined,
				city: city.trim() || undefined,
				state: state.trim() || undefined,
			},
			{
				onSuccess: () => router.back(),
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Edit profile"
				subtitle="NGOs see this when you apply."
			/>

			{me.isLoading ? (
				<LoadingState />
			) : me.isError ? (
				<ErrorState
					message={apiErrorMessage(me.error)}
					onRetry={() => me.refetch()}
				/>
			) : (
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<ScrollView
						{...verticalScrollbar}
						contentContainerStyle={{ paddingBottom: spacing[12] }}
						keyboardShouldPersistTaps="handled"
						automaticallyAdjustKeyboardInsets
					>
						<Field label="Full name">
							<Input
								value={fullName}
								onChangeText={setFullName}
								autoCapitalize="words"
								autoComplete="name"
								textContentType="name"
								accessibilityLabel="Full name"
							/>
						</Field>

						<Field label="Phone">
							<Input
								value={phone}
								onChangeText={setPhone}
								keyboardType="phone-pad"
								autoComplete="tel"
								textContentType="telephoneNumber"
								accessibilityLabel="Phone"
							/>
						</Field>

						<View style={{ flexDirection: "row", gap: spacing[3] }}>
							<View style={{ flex: 1 }}>
								<Field label="City">
									<Input
										value={city}
										onChangeText={setCity}
										autoCapitalize="words"
										accessibilityLabel="City"
									/>
								</Field>
							</View>
							<View style={{ flex: 1 }}>
								<Field label="State">
									<Input
										value={state}
										onChangeText={setState}
										autoCapitalize="words"
										accessibilityLabel="State"
									/>
								</Field>
							</View>
						</View>

						<Field label="About you" optional>
							<Input
								value={bio}
								onChangeText={setBio}
								multiline
								placeholder="Skills, availability, anything NGOs should know"
								accessibilityLabel="About you"
								style={{ minHeight: 110, textAlignVertical: "top" }}
							/>
						</Field>

						{error && (
							<View style={{ marginBottom: spacing[4] }}>
								<Banner
									tone="error"
									title="Couldn't save"
									description={error}
								/>
							</View>
						)}

						<Button
							onPress={save}
							loading={update.isPending}
							style={{ marginTop: spacing[2] }}
						>
							Save changes
						</Button>
					</ScrollView>
				</KeyboardAvoidingView>
			)}
		</Screen>
	);
}

function Field({
	label,
	optional,
	children,
}: {
	label: string;
	optional?: boolean;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[5] }}>
			<Label style={{ marginBottom: spacing[1.5] }}>
				{label}
				{optional && <Caption color="tertiary"> (optional)</Caption>}
			</Label>
			{children}
		</View>
	);
}

export default withAppShell(EditProfile);
