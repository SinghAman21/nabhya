import { updateUserProfileSchema } from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, H2, Label } from "@/components/ui/typography";
import { useUpdateProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { MyProfile } from "@/lib/types";

interface Draft {
	fullName: string;
	phone: string;
	bio: string;
	city: string;
	state: string;
}

/** Edit the signed-in user's personal profile (PATCH /users/me). */
export function ProfileEditSheet({
	visible,
	onClose,
	profile,
}: {
	visible: boolean;
	onClose: () => void;
	profile: MyProfile | undefined;
}) {
	const { colors, spacing } = useTheme();
	const updateProfile = useUpdateProfile();

	const [draft, setDraft] = useState<Draft>(seed(profile));
	const [errors, setErrors] = useState<Record<string, string>>({});

	// biome-ignore lint/correctness/useExhaustiveDependencies: seed only on open
	useEffect(() => {
		if (!visible) return;
		setDraft(seed(profile));
		setErrors({});
	}, [visible, profile?.id]);

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	const submit = () => {
		const parsed = updateUserProfileSchema.safeParse({
			fullName: draft.fullName || undefined,
			phone: draft.phone || undefined,
			bio: draft.bio,
			city: draft.city || undefined,
			state: draft.state || undefined,
		});
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? "form");
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			setErrors(fieldErrors);
			return;
		}

		setErrors({});
		updateProfile.mutate(parsed.data, {
			onSuccess: onClose,
			onError: (error) =>
				Alert.alert("Could not save changes", apiErrorMessage(error)),
		});
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						paddingHorizontal: spacing[6],
						paddingTop: spacing[6],
						paddingBottom: spacing[2],
					}}
				>
					<H2>Edit profile</H2>
					<Pressable onPress={onClose} hitSlop={12}>
						<X size={22} color={colors.text.tertiary as string} />
					</Pressable>
				</View>

				<ScrollView
					contentContainerStyle={{
						padding: spacing[6],
						paddingTop: spacing[4],
					}}
					keyboardShouldPersistTaps="handled"
				>
					<Label style={{ marginBottom: spacing[1.5] }}>Full name</Label>
					<Input
						value={draft.fullName}
						onChangeText={(v) => set("fullName", v)}
						style={inputStyle}
					/>
					<FieldError message={errors.fullName} />

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Phone
					</Label>
					<Input
						value={draft.phone}
						onChangeText={(v) => set("phone", v)}
						keyboardType="phone-pad"
						style={inputStyle}
					/>
					<FieldError message={errors.phone} />

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						About you <Caption color="tertiary">(optional)</Caption>
					</Label>
					<Input
						placeholder="A line about you and the causes you care about"
						value={draft.bio}
						onChangeText={(v) => set("bio", v)}
						multiline
						style={{ ...inputStyle, minHeight: 90, textAlignVertical: "top" }}
					/>
					<FieldError message={errors.bio} />

					<View
						style={{
							flexDirection: "row",
							gap: spacing[3],
							marginTop: spacing[5],
						}}
					>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>City</Label>
							<Input
								value={draft.city}
								onChangeText={(v) => set("city", v)}
								style={inputStyle}
							/>
							<FieldError message={errors.city} />
						</View>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>State</Label>
							<Input
								value={draft.state}
								onChangeText={(v) => set("state", v)}
								style={inputStyle}
							/>
							<FieldError message={errors.state} />
						</View>
					</View>

					<View style={{ height: spacing[6] }} />
					<Button onPress={submit} loading={updateProfile.isPending}>
						Save changes
					</Button>
				</ScrollView>
			</View>
		</Modal>
	);
}

function seed(profile: MyProfile | undefined): Draft {
	return {
		fullName: profile?.name ?? "",
		phone: profile?.phone ?? "",
		bio: profile?.bio ?? "",
		city: profile?.city ?? "",
		state: profile?.state ?? "",
	};
}

function FieldError({ message }: { message?: string }) {
	const { colors, spacing } = useTheme();
	if (!message) return null;
	return (
		<Caption
			color={colors.error.main as string}
			style={{ marginTop: spacing[1] }}
		>
			{message}
		</Caption>
	);
}
