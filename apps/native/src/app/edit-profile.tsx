import {
	type FieldErrors,
	type UpdateUserProfilePayload,
	updateUserProfileSchema,
	validateStep,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withAppShell } from "@/components/app-shell";
import { MultiChoiceChips } from "@/components/choice-chips";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import {
	LocationFields,
	type LocationValue,
} from "@/components/onboarding/location-fields";
import { PhotoField } from "@/components/onboarding/photo-field";
import { FieldPair } from "@/components/onboarding/wizard";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	SectionTitle,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Caption } from "@/components/ui/typography";
import { useCategories, useMe, useUpdateProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { normaliseCityName } from "@/lib/cities";
import { READING_COLUMN } from "@/lib/reading-column";
import { verticalScrollbar } from "@/lib/scroll";
import type { MyProfile } from "@/lib/types";

const MAX_CAUSES = 5;

interface Draft {
	fullName: string;
	phone: string;
	bio: string;
	profileImage: string;
	profileImagePreview: string;
	location: LocationValue;
	categoryIds: string[];
}

function draftFrom(me: MyProfile): Draft {
	const latitude = me.latitude ? Number(me.latitude) : undefined;
	const longitude = me.longitude ? Number(me.longitude) : undefined;
	return {
		fullName: me.name ?? "",
		phone: me.phone ?? "",
		bio: me.bio ?? "",
		profileImage: me.profileImage ?? "",
		profileImagePreview: "",
		location: {
			city: me.city ?? "",
			state: me.state ?? "",
			...(latitude !== undefined && longitude !== undefined
				? { latitude, longitude }
				: {}),
		},
		categoryIds: me.interestCategoryIds,
	};
}

/**
 * Everything the volunteer told onboarding, editable in one place: photo,
 * name and phone, city, causes, and the note to NGOs.
 *
 * Built from the wizard's own parts - `PhotoField`, `LocationFields`,
 * `MultiChoiceChips` - so a city typed here is normalised by `lib/cities.ts`
 * exactly as it was at sign-up. This screen used to be four bare text inputs:
 * "mumbai" saved as a city with nothing in it, the photo and causes could not
 * be changed at all (the causes step promises "pick causes later from your
 * profile"), and a cleared bio was sent as `undefined` - "leave it alone" -
 * so it could never be removed.
 *
 * What is sent is the raw form, not the parsed one, for the reason in
 * `apps/native/AGENTS.md`: `optionalText` turns `""` into `null` on the
 * server, and `null` is not valid *input*. So a cleared bio or photo goes as
 * `""`, which the server stores as `null`. Name, phone, city and state can be
 * changed but not blanked, and say so under the field rather than silently
 * keeping the old value.
 */
function EditProfile() {
	const { colors, spacing } = useTheme();
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(112);

	const me = useMe();
	const categories = useCategories();
	const update = useUpdateProfile();

	const [draft, setDraft] = useState<Draft | null>(null);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [error, setError] = useState<string | null>(null);
	const [photoBusy, setPhotoBusy] = useState(false);

	// Seed once. Re-seeding on every `me` refetch would throw away what is
	// being typed the moment the window regains focus.
	useEffect(() => {
		if (me.data && !draft) setDraft(draftFrom(me.data));
	}, [me.data, draft]);

	const merge = (fields: Partial<Draft>) =>
		setDraft((current) => (current ? { ...current, ...fields } : current));

	const toggleCause = (id: string) => {
		if (!draft) return;
		const has = draft.categoryIds.includes(id);
		if (!has && draft.categoryIds.length >= MAX_CAUSES) return;
		merge({
			categoryIds: has
				? draft.categoryIds.filter((value) => value !== id)
				: [...draft.categoryIds, id],
		});
	};

	const leave = () => {
		if (router.canGoBack()) router.back();
		else router.replace("/(volunteer)/profile");
	};

	const save = () => {
		if (!draft || !me.data) return;
		setError(null);

		const { location } = draft;
		const payload: UpdateUserProfilePayload = {
			fullName: draft.fullName,
			// A phone that was never set stays unset; one that was set cannot be
			// blanked, and the schema says so under the field.
			...(draft.phone.trim() || me.data.phone ? { phone: draft.phone } : {}),
			city: location.city,
			state: location.state,
			bio: draft.bio,
			profileImage: draft.profileImage,
			categoryIds: draft.categoryIds,
			// A pin, or an explicit "no pin" once a typed city replaced one.
			...(location.latitude !== undefined && location.longitude !== undefined
				? { latitude: location.latitude, longitude: location.longitude }
				: me.data.latitude
					? { latitude: null, longitude: null }
					: {}),
		};

		const checked = validateStep(updateUserProfileSchema, payload);
		if (!checked.ok) {
			setErrors(checked.errors);
			// The field may be scrolled out of sight above a pinned button that
			// otherwise looks like it did nothing.
			setError("Check the fields marked in red, then save again.");
			return;
		}
		setErrors({});

		update.mutate(payload, {
			onSuccess: () => {
				toast.success("Profile saved.");
				leave();
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	const causeOptions = (categories.data ?? []).map((category) => ({
		value: category.id,
		label: category.name,
	}));

	return (
		<Screen style={READING_COLUMN}>
			<ScreenHeader
				back
				title="Edit profile"
				subtitle="NGOs see this when you apply or offer help."
			/>

			{me.isLoading || (me.data && !draft) ? (
				<LoadingState />
			) : me.isError || !draft ? (
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
						contentContainerStyle={{ paddingBottom: spacing[8] }}
						keyboardShouldPersistTaps="handled"
						automaticallyAdjustKeyboardInsets
					>
						<PhotoField
							purpose="AVATAR"
							label="Your photo"
							hint="Optional · Square image, at least 400×400"
							fileName="avatar.jpg"
							imageKey={draft.profileImage}
							previewUri={draft.profileImagePreview}
							onChange={({ key, previewUri }) =>
								merge({ profileImage: key, profileImagePreview: previewUri })
							}
							onBusyChange={setPhotoBusy}
						/>

						<FieldPair>
							<Field label="Full name" error={errors.fullName}>
								<Input
									value={draft.fullName}
									onChangeText={(fullName) => merge({ fullName })}
									autoCapitalize="words"
									autoComplete="name"
									textContentType="name"
									accessibilityLabel="Full name"
									style={inputStyle}
								/>
							</Field>
							<Field
								label="Phone number"
								error={errors.phone}
								hint="Shared with an NGO only after they accept you."
							>
								<Input
									value={draft.phone}
									onChangeText={(phone) => merge({ phone })}
									placeholder="e.g. +91 98765 43210"
									keyboardType="phone-pad"
									autoComplete="tel"
									textContentType="telephoneNumber"
									accessibilityLabel="Phone number"
									style={inputStyle}
								/>
							</Field>
						</FieldPair>

						<LocationFields
							value={draft.location}
							onChange={(fields) => {
								const next = { ...draft.location, ...fields };
								// Typing a different city leaves the detected pin behind;
								// keeping it would measure "near me" from the old place.
								const moved =
									fields.city !== undefined &&
									fields.latitude === undefined &&
									normaliseCityName(fields.city) !==
										normaliseCityName(draft.location.city);
								if (moved) {
									delete next.latitude;
									delete next.longitude;
								}
								merge({ location: next });
							}}
							cityError={errors.city}
							stateError={errors.state}
							detectLede="Puts NGOs and needs near you first"
						/>

						<View style={{ marginTop: spacing[6] }}>
							<SectionTitle>Causes you care about</SectionTitle>
							{categories.isLoading ? (
								<LoadingState label="Loading causes" />
							) : categories.isError ? (
								<ErrorState
									message="Couldn't load causes. Your current picks are kept."
									onRetry={() => categories.refetch()}
								/>
							) : (
								<>
									<MultiChoiceChips
										label="Causes you care about"
										options={causeOptions}
										values={draft.categoryIds}
										onToggle={toggleCause}
										max={MAX_CAUSES}
									/>
									<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
										{draft.categoryIds.length >= MAX_CAUSES
											? `${MAX_CAUSES} of ${MAX_CAUSES} chosen - deselect one to swap.`
											: `Up to ${MAX_CAUSES}. They decide what "For you" shows first.`}
									</Caption>
									<FieldError message={errors.categoryIds} />
								</>
							)}
						</View>

						<Field
							label="About you"
							optional
							error={errors.bio}
							hint="Skills, availability, languages - anything an NGO should know."
							style={{ marginTop: spacing[6] }}
						>
							<Input
								value={draft.bio}
								onChangeText={(bio) => merge({ bio })}
								multiline
								accessibilityLabel="About you"
								style={textAreaStyle}
							/>
						</Field>
					</ScrollView>

					{/* Pinned, like the wizards: the form is taller than a phone now,
					    and a save button below the fold reads as a form with none. */}
					<View
						style={{
							paddingTop: spacing[3],
							paddingBottom: insets.bottom + spacing[3],
							borderTopWidth: 1,
							borderTopColor: colors.border.hairline,
							gap: spacing[3],
						}}
					>
						{error ? (
							<Banner tone="error" title="Couldn't save" description={error} />
						) : null}
						<Button
							onPress={save}
							loading={update.isPending}
							disabled={photoBusy}
						>
							{photoBusy ? "Uploading photo…" : "Save changes"}
						</Button>
					</View>
				</KeyboardAvoidingView>
			)}
		</Screen>
	);
}

export default withAppShell(EditProfile);
