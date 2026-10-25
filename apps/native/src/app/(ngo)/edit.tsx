import {
	type FieldErrors,
	type UpdateOrganizationInput,
	updateOrganizationSchema,
	validateStep,
} from "@nabhya/shared";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	type LayoutChangeEvent,
	ScrollView,
	type ScrollViewInstance,
	View,
	type ViewStyle,
} from "react-native";
import { MultiChoiceChips } from "@/components/choice-chips";
import { Field, useFieldInputStyle } from "@/components/form-field";
import { LocationFields } from "@/components/onboarding/location-fields";
import {
	COVER_ASPECT,
	COVER_HINT,
	ImagePickerSlot,
	LOGO_HINT,
} from "@/components/org-branding";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Caption } from "@/components/ui/typography";
import { useOrgAccess } from "@/hooks/use-org-access";
import {
	useMyOrganization,
	useUpdateMyOrganization,
} from "@/hooks/use-organization";
import { useCategories } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useImageUpload } from "@/hooks/use-upload";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The public record, editable.
 *
 * ## Layout
 *
 * The form lives in one capped column, and short fields are paired into rows on
 * desktop. Before that it was a single stack inside the `(ngo)` shell's 1440pt
 * content area, so "Pincode" and "Phone" were input bars a foot wide - a text
 * box whose width promises four times what it wants is a text box you distrust.
 * Each group is a `Surface` too, which is what `useFieldInputStyle` was written
 * for ("the quiet input treatment used inside cards"): grouped fields on a card
 * read as one decision, where the bare stack read as nineteen.
 *
 * ## The two images
 *
 * Cover and logo are picked here and nowhere else - the camera controls on the
 * profile hero navigate to this screen rather than opening their own picker, so
 * there is one code path that knows the aspect ratios and the size limits.
 *
 * They upload straight to object storage on pick (the bytes never pass through
 * our API) and what is stored on the form is the returned **object key**, not a
 * URL. The picked file's local `uri` is kept alongside it purely so the slot
 * can show the new image before the record round-trips - a key cannot be
 * displayed without a signed download URL, and asking for one for an object
 * uploaded two seconds ago is a request that can lose a race with its own
 * bucket.
 *
 * ## Clearing a field
 *
 * `optionalText` in `@nabhya/shared` maps `""` to `null` ("clear it") and skips
 * `undefined` ("not provided") - see trap 5 in the root `AGENTS.md`. This screen
 * used to send `undefined` for every blank optional field, with a comment
 * claiming that cleared them; it did the opposite, so a website or a mission
 * statement could be set once and never removed. Optional text now sends the
 * empty string; only the fields whose schema has a minimum length (name, phone,
 * email, city, state) fall back to `undefined`, because `""` would fail their
 * validation rather than clear them. `pincode` is in that second group too:
 * its schema is `min(4)`, not `optionalText`, so sending `""` to clear it was a
 * 400 on every save after the field had been emptied.
 *
 * ## Validation
 *
 * The form checks itself against `updateOrganizationSchema` before it sends
 * anything, and puts each problem under its field. It used to send and wait:
 * the server's 400 came back as one sentence in a banner at the *top* of a
 * six-section form whose Save button is at the bottom, so the press looked
 * dead. Now a failed Save scrolls to the first section with a problem, the
 * banner counts them, and once Save has been pressed every field re-checks as
 * it is typed in, so the count falls as they are fixed.
 *
 * Required fields are checked here rather than by the schema, because the
 * payload leaves a blank one `undefined` ("leave it alone") and the schema
 * has nothing to say about a key that is not there. Blank is not a choice
 * the record allows - the name, phone, email and city are what a volunteer
 * uses to reach you - so it is an error on the field, not a silent no-op.
 */

interface Form {
	organizationName: string;
	registrationNumber: string;
	phone: string;
	email: string;
	website: string;
	description: string;
	mission: string;
	vision: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	/** Set by "use my location" in `LocationFields`; never typed. */
	latitude: number | undefined;
	longitude: number | undefined;
	teamSize: string;
	foundingYear: string;
	logo: string;
	coverImage: string;
	categoryIds: string[];
}

const EMPTY: Form = {
	organizationName: "",
	registrationNumber: "",
	phone: "",
	email: "",
	website: "",
	description: "",
	mission: "",
	vision: "",
	address: "",
	city: "",
	state: "",
	pincode: "",
	latitude: undefined,
	longitude: undefined,
	teamSize: "",
	foundingYear: "",
	logo: "",
	coverImage: "",
	categoryIds: [],
};

const MAX_CAUSES = 5;

type Section = "about" | "contact" | "location" | "organisation";

/** Which card a field lives in, for scrolling to the first problem. */
const SECTION_OF: Record<string, Section> = {
	organizationName: "about",
	registrationNumber: "about",
	description: "about",
	mission: "about",
	vision: "about",
	phone: "contact",
	email: "contact",
	website: "contact",
	address: "location",
	city: "location",
	state: "location",
	pincode: "location",
	teamSize: "organisation",
	foundingYear: "organisation",
};
const SECTION_ORDER: Section[] = [
	"about",
	"contact",
	"location",
	"organisation",
];

/**
 * The schema's bounds in words. Zod's defaults ("Too small: expected string
 * to have >=4 characters") are written for a developer reading a 400.
 */
const FIELD_COPY: Record<string, string> = {
	organizationName: "Use at least 2 characters.",
	registrationNumber: "Keep it under 60 characters.",
	description: "Keep it under 1,000 characters.",
	mission: "Keep it under 1,000 characters.",
	vision: "Keep it under 1,000 characters.",
	website: "Enter a full address, starting with https://",
	address: "Keep it under 500 characters.",
	city: "Pick a city from the list.",
	state: "Pick a state from the list.",
	pincode: "Enter a 6-digit pincode.",
	teamSize: "Enter a number of 1 or more.",
	foundingYear: `Enter a year between 1900 and ${new Date().getFullYear()}.`,
};

const REQUIRED: Array<[keyof Form, string]> = [
	["organizationName", "Your organisation needs a name."],
	["phone", "Add a phone number volunteers can reach you on."],
	["email", "Add a contact email."],
	["city", "Pick the city you work in."],
	["state", "Pick your state."],
];

/**
 * A form column, not a page column. Wider than this and a single-line input
 * paired with nothing has more white space in it than text.
 */
const FORM: ViewStyle = {
	width: "100%",
	maxWidth: 760,
	alignSelf: "center",
};

/** The logo slot's edge. Square, and small enough to sit beside the cover. */
const LOGO_SLOT = 116;

export default function EditOrganization() {
	const { spacing } = useTheme();
	const router = useRouter();
	const { isDesktop } = useMedia();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(88);
	const addressStyle = useFieldInputStyle(80);

	const org = useMyOrganization();
	const access = useOrgAccess();
	const categories = useCategories();
	const update = useUpdateMyOrganization();

	const coverUpload = useImageUpload("ORG_COVER");
	const logoUpload = useImageUpload("ORG_LOGO");

	const [form, setForm] = useState<Form>(EMPTY);
	const [error, setError] = useState<string | null>(null);
	// Local previews for a file picked in this session - see the header note.
	const [coverPreview, setCoverPreview] = useState<string | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [attempted, setAttempted] = useState(false);
	const scroller = useRef<ScrollViewInstance>(null);
	const sectionY = useRef<Partial<Record<Section, number>>>({});
	const track = (section: Section) => (event: LayoutChangeEvent) => {
		sectionY.current[section] = event.nativeEvent.layout.y;
	};

	/** Two fields on one row on desktop, one per row on a phone. */
	const half = isDesktop ? { flex: 1 } : undefined;
	const row: ViewStyle = isDesktop
		? { flexDirection: "row", gap: spacing[4] }
		: {};

	// Hydrate once the organization loads - once, keyed on its id. Re-running
	// on every `org.data` change meant a background refetch (window focus,
	// another screen's invalidation) silently replaced whatever had been typed.
	// Everything is a string in the form so a cleared field is distinguishable
	// from an untouched one.
	const hydratedFor = useRef<string | null>(null);
	useEffect(() => {
		if (!org.data || hydratedFor.current === org.data.id) return;
		hydratedFor.current = org.data.id;
		setForm({
			organizationName: org.data.organizationName ?? "",
			registrationNumber: org.data.registrationNumber ?? "",
			phone: org.data.phone ?? "",
			email: org.data.email ?? "",
			website: org.data.website ?? "",
			description: org.data.description ?? "",
			mission: org.data.mission ?? "",
			vision: org.data.vision ?? "",
			address: org.data.address ?? "",
			city: org.data.city ?? "",
			state: org.data.state ?? "",
			pincode: org.data.pincode ?? "",
			latitude: org.data.latitude ? Number(org.data.latitude) : undefined,
			longitude: org.data.longitude ? Number(org.data.longitude) : undefined,
			teamSize: org.data.teamSize ? String(org.data.teamSize) : "",
			foundingYear: org.data.foundingYear ? String(org.data.foundingYear) : "",
			logo: org.data.logo ?? "",
			coverImage: org.data.coverImage ?? "",
			categoryIds: org.data.categories?.map((c) => c.id) ?? [],
		});
	}, [org.data]);

	const set = <K extends keyof Form>(key: K, value: Form[K]) =>
		setForm((f) => ({ ...f, [key]: value }));

	const toggleCategory = (id: string) => {
		setForm((f) => ({
			...f,
			categoryIds: f.categoryIds.includes(id)
				? f.categoryIds.filter((c) => c !== id)
				: f.categoryIds.length >= MAX_CAUSES
					? f.categoryIds
					: [...f.categoryIds, id],
		}));
	};

	/**
	 * Pick one image and upload it, keeping the returned key on the form.
	 *
	 * `allowsEditing` gives the native crop box at the right ratio so a portrait
	 * photo is not silently centre-cropped into a cover band. It is ignored on
	 * the web, which is why `contentFit="cover"` does the work everywhere the
	 * image is drawn.
	 */
	const pickImage = async (which: "cover" | "logo") => {
		setError(null);
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsMultipleSelection: false,
			allowsEditing: true,
			aspect: which === "cover" ? [COVER_ASPECT, 1] : [1, 1],
			quality: 0.9,
		});
		if (result.canceled) return;

		const asset = result.assets?.[0];
		if (!asset) return;

		const uploader = which === "cover" ? coverUpload : logoUpload;
		const uploaded = await uploader.uploadImage(asset.uri, {
			fileName: which === "cover" ? "cover.jpg" : "logo.jpg",
			sourceWidth: asset.width,
			maxWidth: which === "cover" ? 1600 : 600,
		});
		if (!uploaded) return;

		if (which === "cover") {
			set("coverImage", uploaded.key);
			setCoverPreview(asset.uri);
		} else {
			set("logo", uploaded.key);
			setLogoPreview(asset.uri);
		}
	};

	const clearImage = (which: "cover" | "logo") => {
		if (which === "cover") {
			set("coverImage", "");
			setCoverPreview(null);
		} else {
			set("logo", "");
			setLogoPreview(null);
		}
	};

	const buildPayload = (): UpdateOrganizationInput => ({
		// Minimum-length fields: blank means "leave it alone", because the
		// schema would reject "" rather than treat it as a clear.
		organizationName: form.organizationName.trim() || undefined,
		phone: form.phone.trim() || undefined,
		email: form.email.trim() || undefined,
		city: form.city.trim() || undefined,
		state: form.state.trim() || undefined,
		// `optionalText` fields: "" is how you clear one.
		registrationNumber: form.registrationNumber.trim(),
		description: form.description.trim(),
		mission: form.mission.trim(),
		vision: form.vision.trim(),
		address: form.address.trim(),
		pincode: form.pincode.trim() || undefined,
		logo: form.logo.trim(),
		coverImage: form.coverImage.trim(),
		// Its schema is `url() | ""`, so the empty string is already allowed.
		website: form.website.trim(),
		// null clears; the schema takes it for these two.
		teamSize: form.teamSize ? Number(form.teamSize) : null,
		foundingYear: form.foundingYear ? Number(form.foundingYear) : null,
		...(form.latitude !== undefined && form.longitude !== undefined
			? { latitude: form.latitude, longitude: form.longitude }
			: {}),
		categoryIds: form.categoryIds,
	});

	const validate = (): FieldErrors => {
		const next: FieldErrors = {};
		for (const [key, message] of REQUIRED) {
			const value = form[key];
			if (typeof value === "string" && !value.trim()) next[key] = message;
		}
		const result = validateStep(updateOrganizationSchema, buildPayload());
		if (!result.ok) {
			for (const [key, message] of Object.entries(result.errors)) {
				if (!next[key]) next[key] = FIELD_COPY[key] ?? message;
			}
		}
		return next;
	};

	// Live once Save has been pressed, silent before - an error under a field
	// the person has not reached yet is a scolding, not help.
	const fieldErrors: FieldErrors = attempted ? validate() : {};
	const errorCount = Object.keys(fieldErrors).length;

	const save = () => {
		setAttempted(true);
		const problems = validate();
		const first = SECTION_ORDER.find((section) =>
			Object.keys(problems).some((key) => SECTION_OF[key] === section),
		);
		if (first) {
			scroller.current?.scrollTo({
				y: Math.max(0, (sectionY.current[first] ?? 0) - 12),
				animated: true,
			});
			return;
		}
		if (Object.keys(problems).length > 0) return;

		setError(null);
		update.mutate(buildPayload(), {
			onSuccess: () => {
				toast.success("Profile saved.");
				if (router.canGoBack()) router.back();
				else router.replace("/(ngo)/profile");
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	const uploadError = coverUpload.error ?? logoUpload.error;
	const busy = coverUpload.isUploading || logoUpload.isUploading;
	const editBlocked = access.blocked("org.edit");

	const saveButton = (
		<Button
			size="sm"
			onPress={save}
			loading={update.isPending}
			disabled={org.isLoading || org.isError || busy || !!editBlocked}
		>
			Save
		</Button>
	);

	return (
		<Screen>
			<View style={FORM}>
				<ScreenHeader back title="Edit profile" action={saveButton} />
				{editBlocked && (
					<View style={{ marginBottom: spacing[4] }}>
						<Banner tone="info" title="View only" description={editBlocked} />
					</View>
				)}
			</View>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError ? (
				<ErrorState
					message={apiErrorMessage(org.error)}
					onRetry={() => org.refetch()}
				/>
			) : (
				<ScrollView
					ref={scroller}
					{...verticalScrollbar}
					contentContainerStyle={{ paddingBottom: spacing[12] }}
					keyboardShouldPersistTaps="handled"
					automaticallyAdjustKeyboardInsets
				>
					<View style={[FORM, { gap: spacing[6] }]}>
						{errorCount > 0 ? (
							<Banner
								tone="error"
								title={`${errorCount} field${errorCount === 1 ? " needs" : "s need"} fixing before you can save`}
								description="Each one is marked below."
							/>
						) : null}

						{error || uploadError ? (
							<Banner
								tone="error"
								title={error ? "Could not save" : "Could not upload"}
								description={error ?? uploadError ?? undefined}
							/>
						) : null}

						{/* Branding ------------------------------------------------- */}
						<View>
							<SectionTitle>Branding</SectionTitle>
							<Surface>
								<View
									style={{
										flexDirection: isDesktop ? "row" : "column",
										alignItems: "flex-start",
										gap: spacing[5],
									}}
								>
									<View style={{ flex: 1, width: "100%" }}>
										<ImagePickerSlot
											label="Cover photo"
											hint={COVER_HINT}
											imageKey={form.coverImage || null}
											localUri={coverPreview}
											aspectRatio={COVER_ASPECT}
											busy={coverUpload.isUploading}
											onPress={() => pickImage("cover")}
											onClear={() => clearImage("cover")}
										/>
									</View>
									<ImagePickerSlot
										label="Logo"
										hint={LOGO_HINT}
										imageKey={form.logo || null}
										localUri={logoPreview}
										width={LOGO_SLOT}
										rounded
										busy={logoUpload.isUploading}
										onPress={() => pickImage("logo")}
										onClear={() => clearImage("logo")}
									/>
								</View>
							</Surface>
						</View>

						{/* About ---------------------------------------------------- */}
						<View onLayout={track("about")}>
							<SectionTitle>About</SectionTitle>
							<Surface>
								<View style={row}>
									<Field
										label="Organisation name"
										error={fieldErrors.organizationName}
										style={half}
									>
										<Input
											value={form.organizationName}
											onChangeText={(v) => set("organizationName", v)}
											autoCapitalize="words"
											style={inputStyle}
										/>
									</Field>
									<Field
										label="Registration number"
										error={fieldErrors.registrationNumber}
										hint="A reviewer checks it against your upload."
										style={half}
									>
										<Input
											value={form.registrationNumber}
											onChangeText={(v) => set("registrationNumber", v)}
											autoCapitalize="characters"
											autoCorrect={false}
											style={inputStyle}
										/>
									</Field>
								</View>
								<Field
									label="Short description"
									error={fieldErrors.description}
									hint="One or two lines. This is the first thing a volunteer reads."
								>
									<Input
										value={form.description}
										onChangeText={(v) => set("description", v)}
										multiline
										placeholder="e.g. We run evening classes for 300 children in Dharavi."
										style={textAreaStyle}
									/>
								</Field>
								<View style={row}>
									<Field
										label="Mission"
										error={fieldErrors.mission}
										optional
										style={half}
									>
										<Input
											value={form.mission}
											onChangeText={(v) => set("mission", v)}
											multiline
											placeholder="What you set out to change"
											style={textAreaStyle}
										/>
									</Field>
									<Field
										label="Vision"
										error={fieldErrors.vision}
										optional
										style={half}
									>
										<Input
											value={form.vision}
											onChangeText={(v) => set("vision", v)}
											multiline
											placeholder="What the world looks like when you succeed"
											style={textAreaStyle}
										/>
									</Field>
								</View>
							</Surface>
						</View>

						{/* Causes --------------------------------------------------- */}
						<View>
							<SectionTitle>Causes</SectionTitle>
							<Surface>
								<Field
									label="What you work on"
									hint={`Up to ${MAX_CAUSES}. Volunteers filter the feed by these.`}
									style={{ marginBottom: 0 }}
								>
									{categories.isLoading ? (
										<Caption color="quaternary">Loading causes…</Caption>
									) : (
										<MultiChoiceChips
											label="Causes"
											options={(categories.data ?? []).map((category) => ({
												value: category.id,
												label: category.name,
											}))}
											values={form.categoryIds}
											onToggle={toggleCategory}
											max={MAX_CAUSES}
										/>
									)}
								</Field>
							</Surface>
						</View>

						{/* Contact -------------------------------------------------- */}
						<View onLayout={track("contact")}>
							<SectionTitle>Contact</SectionTitle>
							<Surface>
								<View style={row}>
									<Field label="Phone" error={fieldErrors.phone} style={half}>
										<Input
											value={form.phone}
											onChangeText={(v) => set("phone", v)}
											keyboardType="phone-pad"
											style={[inputStyle, { maxWidth: 280 }]}
										/>
									</Field>
									<Field label="Email" error={fieldErrors.email} style={half}>
										<Input
											value={form.email}
											onChangeText={(v) => set("email", v)}
											keyboardType="email-address"
											autoCapitalize="none"
											autoCorrect={false}
											style={inputStyle}
										/>
									</Field>
								</View>
								<Field
									label="Website"
									error={fieldErrors.website}
									optional
									style={{ marginBottom: 0 }}
								>
									<Input
										value={form.website}
										onChangeText={(v) => set("website", v)}
										keyboardType="url"
										autoCapitalize="none"
										autoCorrect={false}
										placeholder="https://yourngo.org"
										style={inputStyle}
									/>
								</Field>
							</Surface>
						</View>

						{/* Location ------------------------------------------------- */}
						<View onLayout={track("location")}>
							<SectionTitle>Location</SectionTitle>
							<Surface>
								<Field label="Address" error={fieldErrors.address}>
									<Input
										value={form.address}
										onChangeText={(v) => set("address", v)}
										multiline
										placeholder="Street, building, landmark"
										style={addressStyle}
									/>
								</Field>
								{/* The wizard's control, not two free-text boxes: every feed
								    filter matches `city` exactly, and `lib/cities` is the
								    only place that spells a city the way they expect. */}
								<LocationFields
									value={{
										city: form.city,
										state: form.state,
										...(form.latitude !== undefined
											? { latitude: form.latitude }
											: {}),
										...(form.longitude !== undefined
											? { longitude: form.longitude }
											: {}),
									}}
									onChange={(fields) => setForm((f) => ({ ...f, ...fields }))}
									{...(fieldErrors.city ? { cityError: fieldErrors.city } : {})}
									{...(fieldErrors.state
										? { stateError: fieldErrors.state }
										: {})}
									detectLede="Puts you in “NGOs near me” for volunteers around you"
								/>
								<Field
									label="Pincode"
									error={fieldErrors.pincode}
									style={{ marginBottom: 0 }}
								>
									<Input
										value={form.pincode}
										onChangeText={(v) => set("pincode", v.replace(/\D/g, ""))}
										keyboardType="number-pad"
										maxLength={10}
										style={[inputStyle, { maxWidth: 160 }]}
									/>
								</Field>
							</Surface>
						</View>

						{/* Organisation --------------------------------------------- */}
						<View onLayout={track("organisation")}>
							<SectionTitle>Organisation</SectionTitle>
							<Surface>
								<View style={{ flexDirection: "row", gap: spacing[4] }}>
									<Field
										label="Team size"
										error={fieldErrors.teamSize}
										optional
										style={{ flex: 1, marginBottom: 0 }}
									>
										<Input
											value={form.teamSize}
											onChangeText={(v) =>
												set("teamSize", v.replace(/\D/g, ""))
											}
											keyboardType="number-pad"
											placeholder="e.g. 25"
											style={[inputStyle, { maxWidth: 180 }]}
										/>
									</Field>
									<Field
										label="Founded"
										error={fieldErrors.foundingYear}
										optional
										style={{ flex: 1, marginBottom: 0 }}
									>
										<Input
											value={form.foundingYear}
											onChangeText={(v) =>
												set("foundingYear", v.replace(/\D/g, ""))
											}
											keyboardType="number-pad"
											maxLength={4}
											placeholder="e.g. 2015"
											style={[inputStyle, { maxWidth: 180 }]}
										/>
									</Field>
								</View>
							</Surface>
						</View>

						<Button
							onPress={save}
							loading={update.isPending}
							disabled={busy || !!editBlocked}
						>
							Save changes
						</Button>
					</View>
				</ScrollView>
			)}
		</Screen>
	);
}
