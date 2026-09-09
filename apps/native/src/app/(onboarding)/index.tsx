import {
	completeOrgOnboardingSchema,
	type FieldErrors,
	orgCausesStepSchema,
	step1BasicInfoSchema,
	step2AddressSchema,
	step4TeamSchema,
	validateStep,
} from "@nabhya/shared";
import { Redirect, useRouter } from "expo-router";
import {
	FileCheck2,
	MapPin,
	PartyPopper,
	ShieldCheck,
	Users,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { ChoiceChips, MultiChoiceChips } from "@/components/choice-chips";
import { Field, useFieldInputStyle } from "@/components/form-field";
import {
	type DetectedPlace,
	LocationFields,
} from "@/components/onboarding/location-fields";
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
import { COVER_ASPECT, COVER_HINT, LOGO_HINT } from "@/components/org-branding";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
} from "@/components/screen-shell";
import { TextAction } from "@/components/text-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useUpdateMyOrganization } from "@/hooks/use-organization";
import { useCategories, useCompleteOrgOnboarding } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useImageUpload } from "@/hooks/use-upload";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";
import { useAuthStore } from "@/store/auth-store";
import { type OrgDraft, useOnboardingStore } from "@/store/onboarding-store";

const STEPS = ["Organisation", "Location", "Causes", "Team", "Review"] as const;

const MAX_CAUSES = 5;

const ORG_TYPES = [
	{ value: "trust", label: "Trust" },
	{ value: "society", label: "Society" },
	{ value: "section8", label: "Section 8" },
	{ value: "others", label: "Other" },
] as const;

type OrgType = (typeof ORG_TYPES)[number]["value"];

const ORG_TYPE_LABEL: Record<string, string> = Object.fromEntries(
	ORG_TYPES.map((type) => [type.value, type.label]),
);

const COPY = [
	{
		title: "Your organisation",
		lede: "The name and registration number a reviewer will check against your certificate.",
	},
	{
		title: "Where you're based",
		lede: "Volunteers see your city; the full address stays with the review team.",
	},
	{
		title: "What you work on",
		lede: "Causes decide which volunteers ever see you. This is the one step that puts you in someone's feed.",
	},
	{
		title: "Your team and presence",
		lede: "All optional — but a logo and a founding year are what make a stranger believe you exist.",
	},
	{
		title: "Check and create",
		lede: "Tap any line to change it. This creates your organisation; everything stays editable from Profile.",
	},
] as const;

/**
 * The NGO setup wizard.
 *
 * ## What changed, and why
 *
 * **The dead step is gone.** Step 3 used to be a read-only list of the
 * documents verification would later ask for — a screen with nothing to do on
 * it, in the middle of a five-step form, because uploads genuinely cannot
 * happen before the organisation row exists. The same information now arrives
 * on the completion screen, *after* the org is created, where it is followed by
 * a button that actually opens the upload UI.
 *
 * **Causes are collected.** `organization_categories` is what a volunteer's
 * "For you" feed joins through, and nothing in the product asked an NGO for a
 * single category until they found the edit screen. An NGO that onboarded and
 * stopped was invisible to interest matching. The step replaces the dead one,
 * so the wizard is still five steps long.
 *
 * **A logo and coordinates are collected.** Both fields exist on
 * `organizations` and both were only reachable from `(ngo)/edit`, which is why
 * every feed card in the app draws an initial and `GET /organizations/nearby`
 * had almost nothing to rank.
 *
 * **The draft is a draft.** Values lived in `auth-store.orgProfile`, which is
 * persisted and never cleared — a finished NGO carried a copy of its own
 * registration number in secure storage forever. They now live in
 * `onboarding-store`, cleared on success.
 */
export default function OrgOnboarding() {
	const { spacing } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();

	const draft = useOnboardingStore((s) => s.org);
	const merge = useOnboardingStore((s) => s.mergeOrg);
	const clear = useOnboardingStore((s) => s.clearOrg);
	const step = useOnboardingStore((s) => s.orgStep);
	const setStep = useOnboardingStore((s) => s.setOrgStep);
	const isHydrated = useOnboardingStore((s) => s.isHydrated);

	const role = useAuthStore((s) => s.role);
	const isOnboarded = useAuthStore((s) => s.isOnboarded);

	const categories = useCategories();
	const complete = useCompleteOrgOnboarding();
	const logoUpload = useImageUpload("ORG_LOGO");
	const coverUpload = useImageUpload("ORG_COVER");
	const updateOrg = useUpdateMyOrganization();

	const [errors, setErrors] = useState<FieldErrors>({});
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [createdName, setCreatedName] = useState<string | null>(null);
	const [brandingFailed, setBrandingFailed] = useState(false);

	/** A resumed draft never resumes past the first step still incomplete. */
	const clamped = useRef(false);
	useEffect(() => {
		if (!isHydrated || clamped.current) return;
		clamped.current = true;
		const firstIncomplete = !step1Complete(draft)
			? 0
			: !step2Complete(draft)
				? 1
				: STEPS.length - 1;
		if (useOnboardingStore.getState().orgStep > firstIncomplete) {
			setStep(firstIncomplete);
		}
	}, [isHydrated, draft, setStep]);

	const payload = () => ({
		orgName: draft.orgName,
		phone: draft.phone,
		// The draft holds a plain string because nothing is chosen at first;
		// step 1's schema is what proves it is one of the four, and it has run
		// before this payload is ever submitted.
		orgType: draft.orgType as OrgType,
		registrationNumber: draft.registrationNumber,
		address: draft.address,
		city: draft.city,
		state: draft.state,
		pincode: draft.pincode,
		latitude: draft.latitude,
		longitude: draft.longitude,
		categoryIds: draft.categoryIds,
		description: draft.description,
		teamSize: draft.teamSize,
		foundingYear: draft.foundingYear,
		website: draft.website,
	});

	const stepSchema = [
		step1BasicInfoSchema,
		step2AddressSchema,
		orgCausesStepSchema,
		step4TeamSchema,
	];

	const advance = () => {
		setSubmitError(null);
		const schema = stepSchema[step];
		if (schema) {
			const result = validateStep(schema, payload());
			if (!result.ok) {
				setErrors(result.errors);
				return;
			}
		}
		setErrors({});
		setStep(Math.min(step + 1, STEPS.length - 1));
	};

	const back = () => {
		setErrors({});
		setSubmitError(null);
		setStep(Math.max(step - 1, 0));
	};

	const submit = () => {
		setSubmitError(null);
		const body = payload();
		const result = validateStep(completeOrgOnboardingSchema, body);

		if (!result.ok) {
			// Review has no fields, so an error here belongs to an earlier step.
			setErrors(result.errors);
			setStep(stepOwning(Object.keys(result.errors)[0]));
			return;
		}

		const name = draft.orgName;
		const branding = { logo: draft.logoPreview, cover: draft.coverPreview };

		// `body`, not `result.data` — see the note in the volunteer wizard: the
		// parse validates, the server normalises. `description` is the field that
		// would otherwise be posted as `null` and rejected.
		complete.mutate(body, {
			onSuccess: () => {
				clear();
				setCreatedName(name);
				if (branding.logo || branding.cover) void storeBranding(branding);
			},
			onError: (error) =>
				setSubmitError(
					apiErrorMessage(error, "Please check your details and try again."),
				),
		});
	};

	/**
	 * The logo and banner, after the fact.
	 *
	 * Neither can be uploaded during the wizard: `ORG_LOGO` and `ORG_COVER` keys
	 * are derived from the caller's organization, which does not exist until the
	 * request above succeeds (see the note in `photo-field.tsx`). So both files
	 * are held as local URIs through the wizard and stored here — upload the
	 * bytes, then PATCH the returned keys onto the organization in one write.
	 *
	 * A failure here is not a failed signup: the organisation exists either way,
	 * and the completion screen says the images need adding from Profile rather
	 * than pretending the whole thing broke.
	 */
	const storeBranding = async ({
		logo,
		cover,
	}: {
		logo: string;
		cover: string;
	}) => {
		setBrandingFailed(false);

		const [logoKey, coverKey] = await Promise.all([
			logo
				? logoUpload.uploadImage(logo, { fileName: "logo.jpg", maxWidth: 600 })
				: null,
			cover
				? coverUpload.uploadImage(cover, {
						fileName: "cover.jpg",
						maxWidth: 1600,
					})
				: null,
		]);

		if ((logo && !logoKey) || (cover && !coverKey)) setBrandingFailed(true);

		const patch = {
			...(logoKey ? { logo: logoKey.key } : {}),
			...(coverKey ? { coverImage: coverKey.key } : {}),
		};
		if (Object.keys(patch).length === 0) return;

		updateOrg.mutate(patch, { onError: () => setBrandingFailed(true) });
	};

	/* ---------------------------------------------------------------------- */

	// The completion screen outranks every guard below it: finishing the wizard
	// sets `isOnboarded`, and checking that first would replace the "what
	// happens next" screen with a redirect the instant the org was created.
	if (!createdName) {
		// Client-side only, and UX rather than security — the server's `@Roles`
		// and its one-org-per-account conflict are the real gates. This stops a
		// volunteer who deep-links to `/(onboarding)` on the web from filling in
		// a five-step NGO form that can only end in a 403, and stops an NGO that
		// already exists from filling one in that can only end in a 409.
		if (role && role !== "organisation") return <Redirect href="/" />;
		if (isOnboarded) return <Redirect href="/" />;
	}

	if (!isHydrated) {
		return (
			<Screen>
				<LoadingState label="Loading your draft" />
			</Screen>
		);
	}

	if (createdName) {
		return (
			<Screen>
				{/*
				 * Scrollable, not a centred flex box: this screen carries an icon, a
				 * heading, three numbered lines, two buttons and a footnote, which
				 * overflows a short phone — and a branch that can overflow without a
				 * scroller draws its content into `overflow: hidden` (AGENTS.md →
				 * Scrolling on web). `flexGrow` keeps it optically centred while
				 * there is room.
				 */}
				<ScrollView
					contentContainerStyle={{
						flexGrow: 1,
						justifyContent: "center",
						paddingVertical: spacing[6],
						width: "100%",
						maxWidth: 520,
						alignSelf: "center",
					}}
					{...verticalScrollbar}
				>
					<WizardDone
						icon={PartyPopper}
						title={`${createdName} is on Nabhya`}
						lede="One thing left, and it is the thing that unlocks everything else: verification."
						steps={[
							"Upload your registration certificate and the organisation's PAN. 80G and 12A are optional and speed up review.",
							"A reviewer checks them, usually within a few days. You'll be notified either way.",
							"Once verified, your events, needs and updates become public and volunteers can find you.",
						]}
						actions={
							<>
								<Button
									onPress={() => {
										router.replace("/(ngo)/feed");
										router.push("/(ngo)/verification");
									}}
								>
									Upload documents now
								</Button>
								<Button
									variant="ghost"
									onPress={() => router.replace("/(ngo)/feed")}
								>
									Later — take me to my dashboard
								</Button>
							</>
						}
					/>
					{brandingFailed ? (
						<View style={{ marginTop: spacing[6] }}>
							<Banner
								tone="warning"
								title="Your logo or banner didn't upload"
								description="The organisation was created. Add the images from Profile → Edit whenever you like."
							/>
						</View>
					) : null}

					<Caption
						color="quaternary"
						style={{ marginTop: spacing[6], textAlign: "center" }}
					>
						Until you're verified you can still create events and needs — they
						stay private until a reviewer approves your documents.
					</Caption>
				</ScrollView>
			</Screen>
		);
	}

	const copy = COPY[step] ?? COPY[0];
	const isReview = step === STEPS.length - 1;

	return (
		<WizardShell
			steps={STEPS}
			step={step}
			title={copy.title}
			lede={copy.lede}
			error={submitError}
			{...(step > 0 ? { onBack: back } : {})}
			exit={
				step === 0 ? (
					<TextAction
						label={
							signOut.isPending ? "Signing out…" : "Not your NGO? Sign out"
						}
						onPress={() => signOut.mutate()}
						disabled={signOut.isPending}
					/>
				) : null
			}
			aside={
				<WizardAside
					title="What happens with this"
					points={[
						{
							icon: FileCheck2,
							title: "A person reads it",
							body: "Your name and registration number are checked against the certificate you upload next. Get them exactly as printed.",
						},
						{
							icon: ShieldCheck,
							title: "Private until verified",
							body: "Nothing you create is public before a reviewer approves you, and your address and documents are never public at all.",
						},
						{
							icon: MapPin,
							title: "How volunteers find you",
							body: "City, causes and coordinates are what put your needs in someone's feed. Skipping them is why an NGO sees no volunteers.",
						},
						{
							icon: Users,
							title: "You can invite your team after",
							body: "The account you're using becomes the owner. Add coordinators from Team once setup is done.",
						},
					]}
				/>
			}
			footer={
				<WizardFooter
					{...(step > 0 ? { onBack: back } : {})}
					primaryLabel={isReview ? "Create organisation" : "Continue"}
					onPrimary={isReview ? submit : advance}
					loading={complete.isPending}
					{...(step === 2 && draft.categoryIds.length === 0
						? {
								note: "No causes means no interest matching — you can still continue.",
							}
						: {})}
				/>
			}
		>
			{step === 0 && <OrgStep draft={draft} merge={merge} errors={errors} />}

			{step === 1 && (
				<LocationStep draft={draft} merge={merge} errors={errors} />
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

			{step === 3 && <TeamStep draft={draft} merge={merge} errors={errors} />}

			{isReview && (
				<ReviewStep
					draft={draft}
					onEdit={setStep}
					causeNames={(categories.data ?? [])
						.filter((category) => draft.categoryIds.includes(category.id))
						.map((category) => category.name)
						.join(", ")}
				/>
			)}
		</WizardShell>
	);
}

/* -------------------------------------------------------------------------- */
/* Completion checks and error routing                                        */
/* -------------------------------------------------------------------------- */

const step1Complete = (draft: OrgDraft) =>
	Boolean(
		draft.orgName.trim() &&
			draft.orgType &&
			draft.registrationNumber.trim() &&
			draft.phone.trim(),
	);

const step2Complete = (draft: OrgDraft) =>
	Boolean(draft.address.trim() && draft.city.trim() && draft.state.trim());

/** Which step owns a field, so a failed submit lands on the right screen. */
function stepOwning(field: string | undefined): number {
	if (!field) return 0;
	if (["orgName", "orgType", "registrationNumber", "phone"].includes(field)) {
		return 0;
	}
	if (
		["address", "city", "state", "pincode", "latitude", "longitude"].includes(
			field,
		)
	) {
		return 1;
	}
	if (["categoryIds", "description"].includes(field)) return 2;
	return 3;
}

/* -------------------------------------------------------------------------- */
/* Step 1 — the organisation                                                  */
/* -------------------------------------------------------------------------- */

function OrgStep({
	draft,
	merge,
	errors,
}: {
	draft: OrgDraft;
	merge: (fields: Partial<OrgDraft>) => void;
	errors: FieldErrors;
}) {
	const inputStyle = useFieldInputStyle();

	return (
		<View>
			<FieldPair>
				<Field label="Organisation name" error={errors.orgName}>
					<Input
						placeholder="e.g. Helping Hands Foundation"
						value={draft.orgName}
						onChangeText={(orgName) => merge({ orgName })}
						autoCapitalize="words"
						accessibilityLabel="Organisation name"
						style={inputStyle}
					/>
				</Field>

				<Field
					label="Phone"
					error={errors.phone}
					hint="Where volunteers and the review team can reach you."
				>
					<Input
						placeholder="e.g. +91 98765 43210"
						value={draft.phone}
						onChangeText={(phone) => merge({ phone })}
						keyboardType="phone-pad"
						accessibilityLabel="Phone"
						style={inputStyle}
					/>
				</Field>
			</FieldPair>

			<Field label="Registered as" error={errors.orgType}>
				<ChoiceChips
					label="Organisation type"
					options={ORG_TYPES}
					value={draft.orgType as OrgType}
					onChange={(orgType) => merge({ orgType })}
				/>
			</Field>

			<Field
				label="Registration number"
				error={errors.registrationNumber}
				hint="Exactly as printed on your registration certificate."
			>
				<Input
					placeholder="e.g. E-12345 (Mumbai)"
					value={draft.registrationNumber}
					onChangeText={(registrationNumber) => merge({ registrationNumber })}
					autoCapitalize="characters"
					autoCorrect={false}
					accessibilityLabel="Registration number"
					style={inputStyle}
				/>
			</Field>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 2 — location                                                          */
/* -------------------------------------------------------------------------- */

function LocationStep({
	draft,
	merge,
	errors,
}: {
	draft: OrgDraft;
	merge: (fields: Partial<OrgDraft>) => void;
	errors: FieldErrors;
}) {
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(96);

	/**
	 * Fill the address and pincode from what the location control worked out.
	 *
	 * Only into empty fields, never over something typed: having just been told
	 * where someone is, asking them to type it again is rude — but overwriting
	 * an address they entered carefully with a geocoder's guess is worse. A
	 * detected line stays editable, which is the point of putting it in the
	 * field rather than offering it as a suggestion.
	 */
	const fillFromPlace = (place: DetectedPlace) =>
		merge({
			...(place.address && !draft.address.trim()
				? { address: place.address }
				: {}),
			...(place.pincode && !draft.pincode.trim()
				? { pincode: place.pincode.replace(/\D/g, "").slice(0, 6) }
				: {}),
		});

	return (
		<View>
			<LocationFields
				value={{
					city: draft.city,
					state: draft.state,
					...(draft.latitude !== undefined ? { latitude: draft.latitude } : {}),
					...(draft.longitude !== undefined
						? { longitude: draft.longitude }
						: {}),
				}}
				onChange={merge}
				cityError={errors.city}
				stateError={errors.state}
				detectLede="Puts you in “NGOs near me” for volunteers around you"
				onDetectedPlace={fillFromPlace}
			/>

			<Field
				label="Full address"
				error={errors.address}
				hint="Seen only by the review team. Filled in for you if you used the button above."
			>
				<Input
					placeholder="Street, building, landmark"
					value={draft.address}
					onChangeText={(address) => merge({ address })}
					multiline
					accessibilityLabel="Full address"
					style={textAreaStyle}
				/>
			</Field>

			<Field label="Pincode" error={errors.pincode}>
				<Input
					placeholder="400001"
					value={draft.pincode}
					onChangeText={(value) =>
						merge({ pincode: value.replace(/\D/g, "").slice(0, 6) })
					}
					keyboardType="number-pad"
					maxLength={6}
					accessibilityLabel="Pincode"
					style={[inputStyle, { maxWidth: 180 }]}
				/>
			</Field>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 3 — causes                                                            */
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
	draft: OrgDraft;
	merge: (fields: Partial<OrgDraft>) => void;
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
					message="Couldn't load causes. You can continue and add them later from Profile."
					onRetry={onRetry}
				/>
			) : (
				<>
					<MultiChoiceChips
						label="Causes you work on"
						options={options}
						values={draft.categoryIds}
						onToggle={toggle}
						max={MAX_CAUSES}
					/>
					<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
						{draft.categoryIds.length === 0
							? `Pick up to ${MAX_CAUSES}. Volunteers who follow a cause see NGOs that work on it.`
							: draft.categoryIds.length >= MAX_CAUSES
								? `${MAX_CAUSES} of ${MAX_CAUSES} chosen — deselect one to swap.`
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
					label="What you do"
					optional
					error={errors.description}
					hint="One or two lines, in your own words. Shown on your public profile."
				>
					<Input
						placeholder="e.g. We run evening classes for 300 children in Dharavi and a weekend meal drive."
						value={draft.description}
						onChangeText={(description) => merge({ description })}
						multiline
						accessibilityLabel="What you do"
						style={textAreaStyle}
					/>
				</Field>
			</View>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 4 — team and presence                                                 */
/* -------------------------------------------------------------------------- */

function TeamStep({
	draft,
	merge,
	errors,
}: {
	draft: OrgDraft;
	merge: (fields: Partial<OrgDraft>) => void;
	errors: FieldErrors;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();

	return (
		<View>
			{/* Side by side on desktop. Two stacked image slots plus four fields
			    is the one step that would otherwise still scroll on a laptop. */}
			<FieldPair>
				<PhotoField
					purpose="ORG_LOGO"
					label="Logo"
					hint={`Optional · ${LOGO_HINT}`}
					fileName="logo.jpg"
					imageKey=""
					previewUri={draft.logoPreview}
					onChange={({ previewUri }) => merge({ logoPreview: previewUri })}
					deferred
					deferredNote="Stored when your organisation is created."
				/>

				<PhotoField
					purpose="ORG_COVER"
					label="Banner"
					hint={`Optional · ${COVER_HINT}`}
					fileName="cover.jpg"
					imageKey=""
					previewUri={draft.coverPreview}
					onChange={({ previewUri }) => merge({ coverPreview: previewUri })}
					aspectRatio={COVER_ASPECT}
					deferred
					deferredNote="Stored when your organisation is created."
				/>
			</FieldPair>

			<View style={{ flexDirection: "row", gap: spacing[3] }}>
				<Field
					label="Team size"
					optional
					error={errors.teamSize}
					style={{ flex: 1 }}
				>
					<Input
						placeholder="e.g. 25"
						value={draft.teamSize}
						onChangeText={(value) =>
							merge({ teamSize: value.replace(/\D/g, "").slice(0, 6) })
						}
						keyboardType="number-pad"
						accessibilityLabel="Team size"
						style={inputStyle}
					/>
				</Field>
				<Field
					label="Founded in"
					optional
					error={errors.foundingYear}
					style={{ flex: 1 }}
				>
					<Input
						placeholder="e.g. 2015"
						value={draft.foundingYear}
						onChangeText={(value) =>
							merge({ foundingYear: value.replace(/\D/g, "").slice(0, 4) })
						}
						keyboardType="number-pad"
						maxLength={4}
						accessibilityLabel="Founded in"
						style={inputStyle}
					/>
				</Field>
			</View>

			<Field
				label="Website"
				optional
				error={errors.website}
				hint="Include https://"
			>
				<Input
					placeholder="https://yourngo.org"
					value={draft.website}
					onChangeText={(website) => merge({ website })}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					accessibilityLabel="Website"
					style={inputStyle}
				/>
			</Field>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 5 — review                                                            */
/* -------------------------------------------------------------------------- */

function ReviewStep({
	draft,
	causeNames,
	onEdit,
}: {
	draft: OrgDraft;
	causeNames: string;
	onEdit: (step: number) => void;
}) {
	return (
		<ReviewGrid>
			<ReviewSection
				title="Organisation"
				rows={[
					{ label: "Name", value: draft.orgName, onEdit: () => onEdit(0) },
					{
						label: "Registered as",
						value: ORG_TYPE_LABEL[draft.orgType] ?? draft.orgType,
						onEdit: () => onEdit(0),
					},
					{
						label: "Registration no.",
						value: draft.registrationNumber,
						onEdit: () => onEdit(0),
					},
					{ label: "Phone", value: draft.phone, onEdit: () => onEdit(0) },
				]}
			/>

			<ReviewSection
				title="Location"
				rows={[
					{ label: "Address", value: draft.address, onEdit: () => onEdit(1) },
					{
						label: "City and state",
						value: [draft.city, draft.state].filter(Boolean).join(", "),
						onEdit: () => onEdit(1),
					},
					{ label: "Pincode", value: draft.pincode, onEdit: () => onEdit(1) },
					{
						label: "Coordinates",
						value:
							draft.latitude !== undefined && draft.longitude !== undefined
								? "Saved — you'll appear in “near me”"
								: "Not saved",
						onEdit: () => onEdit(1),
					},
				]}
			/>

			<ReviewSection
				title="Causes"
				rows={[
					{ label: "Works on", value: causeNames, onEdit: () => onEdit(2) },
					{
						label: "What you do",
						value: draft.description,
						onEdit: () => onEdit(2),
					},
				]}
			/>

			<ReviewSection
				title="Team and presence"
				rows={[
					{
						label: "Logo",
						value: draft.logoPreview ? "Chosen" : "Not added",
						onEdit: () => onEdit(3),
					},
					{
						label: "Banner",
						value: draft.coverPreview ? "Chosen" : "Not added",
						onEdit: () => onEdit(3),
					},
					{
						label: "Team size",
						value: draft.teamSize,
						onEdit: () => onEdit(3),
					},
					{
						label: "Founded",
						value: draft.foundingYear,
						onEdit: () => onEdit(3),
					},
					{ label: "Website", value: draft.website, onEdit: () => onEdit(3) },
				]}
			/>
		</ReviewGrid>
	);
}
