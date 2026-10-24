import {
	completeVolunteerOnboardingSchema,
	type FieldErrors,
	validateStep,
	volunteerInterestsStepSchema,
	volunteerLocationStepSchema,
	volunteerProfileStepSchema,
} from "@nabhya/shared";
import { Redirect, useRouter } from "expo-router";
import {
	BadgeCheck,
	HeartHandshake,
	MapPin,
	ShieldCheck,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { AccountSignOut } from "@/components/account-sign-out";
import { MultiChoiceChips } from "@/components/choice-chips";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { LocationFields } from "@/components/onboarding/location-fields";
import { PhotoField } from "@/components/onboarding/photo-field";
import {
	FieldPair,
	ReviewGrid,
	WizardFooter,
	WizardShell,
} from "@/components/onboarding/wizard";
import {
	ReviewSection,
	WizardAside,
	WizardDone,
} from "@/components/onboarding/wizard-parts";
import { ErrorState, LoadingState, Screen } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm } from "@/components/ui/overlay";
import { Caption } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import {
	useCategories,
	useCompleteVolunteerOnboarding,
	useMe,
} from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";
import {
	draftHasContent,
	useOnboardingStore,
	type VolunteerDraft,
} from "@/store/onboarding-store";

const STEPS = ["About you", "Location", "Causes", "Review"] as const;
const MAX_CAUSES = 5;

const COPY = [
	{
		title: "Tell NGOs who's turning up",
		lede: "This is what an NGO sees when you apply to an event or pledge an item.",
	},
	{
		title: "Where do you volunteer?",
		lede: "Your city decides what fills your feed. Item donation and event help are local - nobody carries 20 blankets 900km.",
	},
	{
		title: "What do you care about?",
		lede: "We put these causes first in your feed. Change them any time from your profile.",
	},
	{
		title: "Check and finish",
		lede: "Tap any line to change it. Finishing creates your profile - you can verify your identity straight after, or later.",
	},
] as const;

/**
 * Volunteer onboarding.
 *
 * Four steps, one pinned action, and a draft that survives the app being
 * killed - it used to live in `useState`, so backgrounding the app to go and
 * find a phone number lost the form. The shape is deliberately the same as the
 * NGO wizard's (`index.tsx`): same shell, same validation approach, same
 * review-then-done ending, because the two are one flow with two audiences and
 * maintaining them as two different flows is how they drift.
 */
export default function VolunteerOnboarding() {
	const { spacing } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();

	const draft = useOnboardingStore((s) => s.volunteer);
	const mergeDraft = useOnboardingStore((s) => s.mergeVolunteer);
	const clear = useOnboardingStore((s) => s.clearVolunteer);
	const step = useOnboardingStore((s) => s.volunteerStep);
	const setStep = useOnboardingStore((s) => s.setVolunteerStep);
	const isHydrated = useOnboardingStore((s) => s.isHydrated);

	const role = useAuthStore((s) => s.role);
	const isOnboarded = useAuthStore((s) => s.isOnboarded);

	const me = useMe();
	const categories = useCategories();
	const complete = useCompleteVolunteerOnboarding();

	const [errors, setErrors] = useState<FieldErrors>({});
	// Editing a field clears its error. Errors are only set on Continue, so a
	// fixed phone number kept saying "Enter a valid phone number" until the
	// next press - the form contradicting what was plainly typed.
	const merge = (fields: Parameters<typeof mergeDraft>[0]) => {
		mergeDraft(fields);
		setErrors((current) => {
			const stale = Object.keys(fields).filter((key) => key in current);
			if (stale.length === 0) return current;
			const next = { ...current };
			for (const key of stale) delete next[key];
			return next;
		});
	};
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const [photoUploading, setPhotoUploading] = useState(false);

	/**
	 * Seed the name and phone from the account, and only into fields the draft
	 * has not filled - a Google sign-in already told us the name, and typing it
	 * again is the first thing this form used to ask for.
	 *
	 * The ref matters: without it, clearing the name field re-runs this and puts
	 * the account's name straight back, so the field cannot be emptied.
	 */
	const seeded = useRef(false);
	useEffect(() => {
		if (!isHydrated || seeded.current || !me.data) return;
		seeded.current = true;
		const current = useOnboardingStore.getState().volunteer;
		const seed: Partial<VolunteerDraft> = {};
		if (!current.fullName && me.data.name) seed.fullName = me.data.name;
		if (!current.phone && me.data.phone) seed.phone = me.data.phone;
		if (Object.keys(seed).length > 0) mergeDraft(seed);
	}, [isHydrated, me.data, mergeDraft]);

	/**
	 * A resumed draft resumes where it stopped, but never past the first step
	 * that is still incomplete: landing straight on Review with an empty name
	 * (a cleared draft, an old persisted step) is a dead end.
	 */
	const clamped = useRef(false);
	useEffect(() => {
		// Once, on hydration. After that the user's own navigation wins, so this
		// cannot read `step` as a dependency.
		if (!isHydrated || clamped.current) return;
		clamped.current = true;
		const firstIncomplete =
			!draft.fullName.trim() || !draft.phone.trim()
				? 0
				: !draft.city.trim() || !draft.state.trim()
					? 1
					: STEPS.length - 1;
		if (useOnboardingStore.getState().volunteerStep > firstIncomplete) {
			setStep(firstIncomplete);
		}
	}, [
		isHydrated,
		draft.fullName,
		draft.phone,
		draft.city,
		draft.state,
		setStep,
	]);

	const stepPayload = (index: number): unknown => {
		if (index === 0) {
			return {
				fullName: draft.fullName,
				phone: draft.phone,
				profileImage: draft.profileImage,
			};
		}
		if (index === 1) {
			return {
				city: draft.city,
				state: draft.state,
				latitude: draft.latitude,
				longitude: draft.longitude,
			};
		}
		return { categoryIds: draft.categoryIds, bio: draft.bio };
	};

	const stepSchema = [
		volunteerProfileStepSchema,
		volunteerLocationStepSchema,
		volunteerInterestsStepSchema,
	];

	// Set when a step is opened from the review screen's Edit, so Continue
	// validates that one step and returns to review instead of walking
	// through every step after it.
	const [returnToReview, setReturnToReview] = useState(false);
	const reviewStep = STEPS.length - 1;
	const editFromReview = (target: number) => {
		setReturnToReview(true);
		setStep(target);
	};

	const advance = () => {
		setSubmitError(null);
		const schema = stepSchema[step];
		if (schema) {
			const result = validateStep(schema, stepPayload(step));
			if (!result.ok) {
				setErrors(result.errors);
				return;
			}
		}
		setErrors({});
		if (returnToReview) {
			setReturnToReview(false);
			setStep(reviewStep);
			return;
		}
		setStep(Math.min(step + 1, STEPS.length - 1));
	};

	const back = () => {
		setReturnToReview(false);
		setErrors({});
		setSubmitError(null);
		setStep(Math.max(step - 1, 0));
	};

	const submit = () => {
		setSubmitError(null);
		const payload = {
			fullName: draft.fullName,
			phone: draft.phone,
			profileImage: draft.profileImage,
			city: draft.city,
			state: draft.state,
			latitude: draft.latitude,
			longitude: draft.longitude,
			categoryIds: draft.categoryIds,
			bio: draft.bio,
		};
		const result = validateStep(completeVolunteerOnboardingSchema, payload);

		if (!result.ok) {
			// A payload that fails here is a value from an earlier step, so send
			// the user back to the step that owns it rather than showing an error
			// on a review screen with no fields on it.
			setErrors(result.errors);
			const firstBad = Object.keys(result.errors)[0] ?? "";
			setReturnToReview(true);
			setStep(
				["fullName", "phone", "profileImage"].includes(firstBad)
					? 0
					: ["city", "state"].includes(firstBad)
						? 1
						: 2,
			);
			return;
		}

		// `payload`, not `result.data`: the parse is validation only. Sending the
		// parsed output posts `null` for every blank optional field, and `null`
		// is not valid *input* for those fields - the server rejected it with
		// "expected string, received null" on `bio` and `profileImage`.
		complete.mutate(payload, {
			onSuccess: () => {
				clear();
				setDone(true);
			},
			onError: (error) =>
				setSubmitError(
					apiErrorMessage(error, "Check your details and try again."),
				),
		});
	};

	/* ---------------------------------------------------------------------- */

	// See the same block in the NGO wizard: the done screen outranks the
	// guards, because finishing sets `isOnboarded`.
	if (!done) {
		if (role && role !== "volunteer") return <Redirect href="/" />;
		if (isOnboarded) return <Redirect href="/" />;
	}

	if (!isHydrated) {
		return (
			<Screen>
				<LoadingState label="Loading your details" />
			</Screen>
		);
	}

	if (done) {
		return (
			<Screen>
				{/* Scrollable for the same reason as the NGO completion screen. */}
				<ScrollView
					contentContainerStyle={{
						flexGrow: 1,
						justifyContent: "center",
						paddingVertical: spacing[6],
						maxWidth: 480,
						width: "100%",
						alignSelf: "center",
					}}
					{...verticalScrollbar}
				>
					<WizardDone
						icon={BadgeCheck}
						title="You're in"
						lede="Your feed is set to your city and the causes you picked. Two things make NGOs pick you first."
						steps={[
							"Verify your identity - a government ID and a selfie. NGOs accept verified volunteers ahead of everyone else.",
							"Pledge an item or apply to an event. Your certificates and impact build from there.",
						]}
						actions={
							<>
								<Button
									onPress={() => {
										router.replace("/(volunteer)");
										router.push("/verify-identity");
									}}
								>
									Verify my identity
								</Button>
								<Button
									variant="ghost"
									onPress={() => router.replace("/(volunteer)")}
								>
									Later - take me to my feed
								</Button>
							</>
						}
					/>
				</ScrollView>
			</Screen>
		);
	}

	// Signing out clears the draft (`useSignOut`), so a filled-in form asks
	// first - otherwise one stray tap throws away the whole registration.
	const signOutFromWizard = async () => {
		if (draftHasContent(draft)) {
			const ok = await confirm({
				title: "Sign out and discard your draft?",
				message:
					"Everything you've entered so far is cleared from this device.",
				confirmLabel: "Sign out",
				cancelLabel: "Keep my draft",
				destructive: true,
			});
			if (!ok) return;
		}
		signOut.mutate();
	};

	const copy = COPY[step] ?? COPY[0];

	return (
		<WizardShell
			steps={STEPS}
			step={step}
			heading="Your volunteer profile"
			title={copy.title}
			lede={copy.lede}
			error={submitError}
			// Withheld mid-submit, as in the NGO wizard: stepping back while
			// "Finish setup" is in flight leaves the review behind a live request.
			{...(step > 0 && !complete.isPending ? { onBack: back } : {})}
			// Every step, not only the first: the account is just as wrong on
			// step three, and the draft-discard confirm covers the cost.
			exit={
				<AccountSignOut
					onPress={signOutFromWizard}
					pending={signOut.isPending}
				/>
			}
			// Not on the review - see the NGO wizard: the lede already says what
			// finishing does, and a reassurance block under the list is a third
			// layer of help between the reader and the button.
			aside={
				step === STEPS.length - 1 ? undefined : (
					<WizardAside
						title="Why we ask"
						points={[
							{
								icon: HeartHandshake,
								title: "NGOs read this before they accept you",
								body: "A name, a city and a line about yourself is what a coordinator has to go on when they pick who comes on Saturday.",
							},
							{
								icon: MapPin,
								title: "Your city, not your GPS",
								body: "We ask instead of tracking. The feed opens on the city you set and All India is always one tap away.",
							},
							{
								icon: ShieldCheck,
								title: "Nothing here is public",
								body: "Your phone number is shared with an NGO only once they accept you for something.",
							},
						]}
					/>
				)
			}
			footer={
				<WizardFooter
					primaryLabel={
						step === STEPS.length - 1
							? "Finish setup"
							: returnToReview
								? "Back to review"
								: "Continue"
					}
					onPrimary={step === STEPS.length - 1 ? submit : advance}
					loading={complete.isPending}
					// Holding the form for an upload beats losing the photo: the
					// draft only carries the object key once the PUT finishes.
					disabled={photoUploading}
					{...(photoUploading
						? { note: "Waiting for your photo to finish uploading…" }
						: {})}
				/>
			}
		>
			{step === 0 && (
				<AboutStep
					draft={draft}
					merge={merge}
					errors={errors}
					onPhotoBusyChange={setPhotoUploading}
				/>
			)}

			{step === 1 && (
				<LocationFields
					value={{
						city: draft.city,
						state: draft.state,
						...(draft.latitude !== undefined
							? { latitude: draft.latitude }
							: {}),
						...(draft.longitude !== undefined
							? { longitude: draft.longitude }
							: {}),
					}}
					onChange={merge}
					cityError={errors.city}
					stateError={errors.state}
					detectLede="Fills your city, and puts nearby NGOs first"
				/>
			)}

			{step === 2 && (
				<CausesStep
					draft={draft}
					merge={merge}
					errors={errors}
					options={(categories.data ?? []).map((category) => ({
						value: category.id,
						label: category.name,
					}))}
					loading={categories.isLoading}
					failed={categories.isError}
					onRetry={() => categories.refetch()}
				/>
			)}

			{step === 3 && (
				<ReviewStep
					draft={draft}
					onEdit={editFromReview}
					categoryNames={(categories.data ?? [])
						.filter((category) => draft.categoryIds.includes(category.id))
						.map((category) => category.name)
						.join(", ")}
				/>
			)}
		</WizardShell>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 1 - about you                                                         */
/* -------------------------------------------------------------------------- */

function AboutStep({
	draft,
	merge,
	errors,
	onPhotoBusyChange,
}: {
	draft: VolunteerDraft;
	merge: (fields: Partial<VolunteerDraft>) => void;
	errors: FieldErrors;
	onPhotoBusyChange: (busy: boolean) => void;
}) {
	const inputStyle = useFieldInputStyle();

	return (
		<View>
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
				onBusyChange={onPhotoBusyChange}
			/>

			<FieldPair>
				<Field label="Full name" error={errors.fullName}>
					<Input
						placeholder="e.g. Aditi Sharma"
						value={draft.fullName}
						onChangeText={(fullName) => merge({ fullName })}
						autoCapitalize="words"
						autoComplete="name"
						textContentType="name"
						returnKeyType="next"
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
						placeholder="e.g. +91 98765 43210"
						value={draft.phone}
						onChangeText={(phone) => merge({ phone })}
						keyboardType="phone-pad"
						autoComplete="tel"
						textContentType="telephoneNumber"
						returnKeyType="done"
						accessibilityLabel="Phone number"
						style={inputStyle}
					/>
				</Field>
			</FieldPair>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 3 - causes                                                            */
/* -------------------------------------------------------------------------- */

function CausesStep({
	draft,
	merge,
	errors,
	options,
	loading,
	failed,
	onRetry,
}: {
	draft: VolunteerDraft;
	merge: (fields: Partial<VolunteerDraft>) => void;
	errors: FieldErrors;
	options: Array<{ value: string; label: string }>;
	loading: boolean;
	failed: boolean;
	onRetry: () => void;
}) {
	const { colors, spacing } = useTheme();
	const textAreaStyle = useFieldInputStyle(112);

	const toggle = (id: string) =>
		merge({
			categoryIds: draft.categoryIds.includes(id)
				? draft.categoryIds.filter((value) => value !== id)
				: draft.categoryIds.length >= MAX_CAUSES
					? draft.categoryIds
					: [...draft.categoryIds, id],
		});

	return (
		<View>
			{loading ? (
				<LoadingState label="Loading causes" />
			) : failed ? (
				<ErrorState
					message="Couldn't load causes. You can finish setup without them and pick causes later from your profile."
					onRetry={onRetry}
				/>
			) : (
				<>
					<MultiChoiceChips
						label="Causes you care about"
						options={options}
						values={draft.categoryIds}
						onToggle={toggle}
						max={MAX_CAUSES}
					/>
					<Caption
						color={
							draft.categoryIds.length >= MAX_CAUSES ? "tertiary" : "quaternary"
						}
						style={{ marginTop: spacing[2] }}
					>
						{draft.categoryIds.length === 0
							? `Pick up to ${MAX_CAUSES}. Skipping is fine - your feed falls back to your city.`
							: draft.categoryIds.length >= MAX_CAUSES
								? `${MAX_CAUSES} of ${MAX_CAUSES} chosen - deselect one to swap.`
								: `${draft.categoryIds.length} of ${MAX_CAUSES} chosen`}
					</Caption>
					{errors.categoryIds ? (
						<Caption color={colors.error.ink} style={{ marginTop: spacing[1] }}>
							{errors.categoryIds}
						</Caption>
					) : null}
				</>
			)}

			<View style={{ marginTop: spacing[7] }}>
				<Field
					label="About you"
					optional
					error={errors.bio}
					hint="Skills, availability, languages - anything an NGO should know."
				>
					<Input
						placeholder="e.g. Free on weekends, comfortable teaching maths to 10–14 year olds, speaks Marathi and Hindi."
						value={draft.bio}
						onChangeText={(bio) => merge({ bio })}
						multiline
						accessibilityLabel="About you"
						style={textAreaStyle}
					/>
				</Field>
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 4 - review                                                            */
/* -------------------------------------------------------------------------- */

function ReviewStep({
	draft,
	categoryNames,
	onEdit,
}: {
	draft: VolunteerDraft;
	categoryNames: string;
	onEdit: (step: number) => void;
}) {
	return (
		<ReviewGrid>
			<ReviewSection
				title="You"
				rows={[
					{ label: "Name", value: draft.fullName, onEdit: () => onEdit(0) },
					{ label: "Phone", value: draft.phone, onEdit: () => onEdit(0) },
					{
						label: "Photo",
						value: draft.profileImage ? "Added" : "Not added",
						onEdit: () => onEdit(0),
					},
				]}
			/>
			<ReviewSection
				title="Where you are"
				rows={[
					{
						label: "City and state",
						value: [draft.city, draft.state].filter(Boolean).join(", "),
						onEdit: () => onEdit(1),
					},
					{
						label: "Location pin",
						value:
							draft.latitude !== undefined && draft.longitude !== undefined
								? "Saved - nearby NGOs will rank first"
								: // Optional, and "Not saved" read as something that failed.
									"Not shared - optional",
						onEdit: () => onEdit(1),
					},
				]}
			/>
			<ReviewSection
				title="What you care about"
				rows={[
					{ label: "Causes", value: categoryNames, onEdit: () => onEdit(2) },
					{ label: "About you", value: draft.bio, onEdit: () => onEdit(2) },
				]}
			/>
		</ReviewGrid>
	);
}
