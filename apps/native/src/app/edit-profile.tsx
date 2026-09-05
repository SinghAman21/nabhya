import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import {
	ErrorState,
	LoadingState,
	ScreenHeader,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, Label } from "@/components/ui/typography";
import { useMe, useUpdateProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

export default function EditProfile() {
	const { colors, spacing } = useTheme();
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

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

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
				onSuccess: () => {
					Alert.alert("Saved", "Your profile has been updated.");
					router.back();
				},
				onError: (e) => setError(apiErrorMessage(e)),
			},
		);
	};

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				style={{ marginBottom: spacing[4] }}
			>
				<ArrowLeft size={22} color={colors.text.secondary as string} />
			</Pressable>

			<ScreenHeader
				title="Edit profile"
				subtitle="NGOs see this when you apply to their events."
			/>

			{me.isLoading ? (
				<LoadingState />
			) : me.isError ? (
				<ErrorState
					message={apiErrorMessage(me.error)}
					onRetry={() => me.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[12] }}
					keyboardShouldPersistTaps="handled"
				>
					<Label style={{ marginBottom: spacing[1.5] }}>Full name</Label>
					<Input
						value={fullName}
						onChangeText={setFullName}
						autoCapitalize="words"
						style={inputStyle}
					/>

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Phone
					</Label>
					<Input
						value={phone}
						onChangeText={setPhone}
						keyboardType="phone-pad"
						style={inputStyle}
					/>

					<View
						style={{
							flexDirection: "row",
							gap: spacing[3],
							marginTop: spacing[5],
						}}
					>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>City</Label>
							<Input value={city} onChangeText={setCity} style={inputStyle} />
						</View>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>State</Label>
							<Input value={state} onChangeText={setState} style={inputStyle} />
						</View>
					</View>

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						About you <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						value={bio}
						onChangeText={setBio}
						multiline
						placeholder="Skills, availability, anything NGOs should know"
						style={{ ...inputStyle, minHeight: 110, textAlignVertical: "top" }}
					/>

					{error && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[3] }}
						>
							{error}
						</Caption>
					)}

					<Button
						onPress={save}
						loading={update.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Save changes
					</Button>
				</ScrollView>
			)}
		</View>
	);
}
