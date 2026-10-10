import {
	type CreateEventInput,
	type CreateNeedInput,
	createEventSchema,
	createNeedSchema,
	MAX_FEED_MEDIA,
	MAX_FEED_MEDIA_BYTES,
	type PostTag,
	type UpsertAnnouncementInput,
	upsertAnnouncementSchema,
} from "@nabhya/shared";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
	AlertTriangle,
	Clock,
	FileClock,
	ImagePlus,
	Link2,
	Plus,
	Trash2,
	Video,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { ChoiceChips } from "@/components/choice-chips";
import {
	AnnouncementFields,
	type AnnouncementFieldsValue,
} from "@/components/composer/announcement-fields";
import { PostComposerBar } from "@/components/composer/composer-bar";
import {
	defaultEventStart,
	EventFields,
	type EventFieldsValue,
} from "@/components/composer/event-fields";
import { AddTile, MediaTile } from "@/components/composer/media-tiles";
import {
	NeedFields,
	type NeedFieldsValue,
} from "@/components/composer/need-fields";
import { SwitchRow } from "@/components/composer/switch-row";
import { IconPill, InlinePanel, Tool } from "@/components/composer/tools";
import { FieldError } from "@/components/form-field";
import { Banner, SectionTitle } from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { Pressable } from "@/components/ui/pressable";
import { Caption, Label } from "@/components/ui/typography";
import { useCreateAnnouncement } from "@/hooks/use-directory";
import { useCreateEvent, useOrgEvents } from "@/hooks/use-events";
import { useCreateFeedPost } from "@/hooks/use-feed";
import { useCreateNeed, useOrgNeeds } from "@/hooks/use-needs";
import { useOrgAccess } from "@/hooks/use-org-access";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import {
	type ComposerMedia,
	formatBytes,
	type RejectedMedia,
	toComposerMedia,
	uploadFeedMedia,
} from "@/lib/feed-media";
import { focusable } from "@/lib/focus";
import { formatDateRange, formatProgress, formatRelative } from "@/lib/format";
import {
	draftPreview,
	loadDrafts,
	newDraftId,
	type PostDraft,
	saveDrafts,
} from "@/lib/post-drafts";
import { composePostText } from "@/lib/post-text";

/**
 * The NGO writing surface. Creates Updates (`POST /api/feed`), Needs
 * (`POST /api/org/needs`), Events (`POST /api/org/events`) and Announcements
 * (`POST /api/org/announcements`) - each through the endpoint that owns it,
 * so feed cards render real facts.
 *
 * Layout is three bands: type picker, content canvas, details. The footer
 * holds the tools and the publish action. Dismissal keeps the draft;
 * only a successful publish clears the canvas.
 */

const MAX_TEXT = 5000;
const HEADLINE_MAX = 120;
const TITLE_MIN = 4;
/** Character count appears once the body gets this long. */
const COUNTER_AT = 400;

const MEDIA_RULES = `Up to ${MAX_FEED_MEDIA} files · ${formatBytes(
	MAX_FEED_MEDIA_BYTES,
)} each · JPG, PNG, WebP, MP4, MOV`;

type ComposerType = "POST" | "NEED" | "EVENT" | "ANNOUNCEMENT";

interface TypeOption {
	value: ComposerType;
	label: string;
	hint: string;
}

const TYPES: readonly TypeOption[] = [
	{
		value: "POST",
		label: "Update",
		hint: "News and photos. Ranked on recency and your causes.",
	},
	{
		value: "NEED",
		label: "Need",
		hint: "Items you need or are giving away. People pledge against it.",
	},
	{
		value: "EVENT",
		label: "Event",
		hint: "A date, a venue, a headcount. Volunteers apply.",
	},
	{
		value: "ANNOUNCEMENT",
		label: "Announcement",
		hint: "Formal notes - milestones, policies, thank-yous.",
	},
] as const;

interface CanvasCopy {
	headlineLabel: string;
	headlinePlaceholder: string;
	bodyLabel: string;
	bodyPlaceholder: string;
	bodyHint: string;
	bodyMax: number;
}

const COPY: Record<ComposerType, CanvasCopy> = {
	POST: {
		headlineLabel: "Headline",
		headlinePlaceholder: "e.g. Weekend food drive recap",
		bodyLabel: "Update",
		bodyPlaceholder: "What happened, what changed, what's next…",
		bodyHint: "The story volunteers read in the feed.",
		bodyMax: MAX_TEXT,
	},
	NEED: {
		headlineLabel: "Headline",
		headlinePlaceholder: "e.g. 200 winter blankets",
		bodyLabel: "Details",
		bodyPlaceholder: "Condition, sizes, pickup or drop-off…",
		bodyHint: "Anything a helper needs to know before pledging.",
		bodyMax: 2000,
	},
	EVENT: {
		headlineLabel: "Headline",
		headlinePlaceholder: "e.g. Beach clean-up at Juhu",
		bodyLabel: "Description",
		bodyPlaceholder: "What volunteers will do, what to bring, where to meet…",
		bodyHint: "The brief volunteers read before applying.",
		bodyMax: 4000,
	},
	ANNOUNCEMENT: {
		headlineLabel: "Headline",
		headlinePlaceholder: "e.g. We served our 10,000th meal",
		bodyLabel: "Announcement",
		bodyPlaceholder: "Write the announcement…",
		bodyHint: "Published to the feed and your NGO page.",
		bodyMax: 5000,
	},
};

const EMPTY_NEED: NeedFieldsValue = {
	needType: "WANT",
	quantity: "0",
	unit: "",
	expiresAt: undefined,
	placeOpen: false,
};

const emptyEvent = (): EventFieldsValue => {
	const startAt = defaultEventStart();
	return {
		startAt,
		endAt: new Date(startAt.getTime() + 3 * 60 * 60 * 1000),
		deadline: undefined,
		venue: "",
		address: "",
		volunteers: "",
		endTouched: false,
		venueOpen: false,
		addressOpen: false,
		placeOpen: false,
	};
};

const EMPTY_ANNOUNCEMENT: AnnouncementFieldsValue = { pinned: false };

function toComposerType(tag: PostTag | "URGENT" | undefined): ComposerType {
	switch (tag) {
		case "NEED":
			return "NEED";
		case "EVENT":
			return "EVENT";
		case "ANNOUNCEMENT":
			return "ANNOUNCEMENT";
		default:
			return "POST";
	}
}

function toComposerUrgent(tag: PostTag | "URGENT" | undefined): boolean {
	return tag === "URGENT";
}

type Panel = "none" | "drafts";

export { PostComposerBar };

/* -------------------------------------------------------------------------- */
/* Composer                                                                   */
/* -------------------------------------------------------------------------- */

export function PostComposer({
	visible,
	onClose,
	initialTag,
	openPickerOnMount,
	openDraftsOnMount,
}: {
	visible: boolean;
	onClose: () => void;
	initialTag?: PostTag;
	openPickerOnMount?: boolean;
	openDraftsOnMount?: boolean;
}) {
	const { colors, spacing, borderRadius, typography } = useTheme();
	const router = useRouter();
	const publish = useCreateFeedPost();
	const createNeed = useCreateNeed();
	const createEvent = useCreateEvent();
	const createAnnouncement = useCreateAnnouncement();

	const org = useMyOrganization();
	const orgName = org.data?.organizationName ?? "Your NGO";
	const isVerified = org.data?.verificationStatus === "VERIFIED";
	// Suspension and team role, the two checks besides verification that the
	// server makes on every publish. The callers disable their entry points,
	// but a draft restored or a tile pressed mid-refetch could still open the
	// drawer, and a full form ending in a 403 is the worst way to learn it.
	const roleBlocked = useOrgAccess().blocked("content.publish");

	const [type, setType] = useState<ComposerType>(toComposerType(initialTag));
	const [headline, setHeadline] = useState("");
	const [text, setText] = useState("");
	const [urgent, setUrgent] = useState(toComposerUrgent(initialTag));
	const [media, setMedia] = useState<ComposerMedia[]>([]);
	const [rejected, setRejected] = useState<RejectedMedia[]>([]);
	const [formError, setFormError] = useState<string | null>(null);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pickerBusy, setPickerBusy] = useState(false);
	const [panel, setPanel] = useState<Panel>("none");
	const [referenceOpen, setReferenceOpen] = useState(false);
	const [drafts, setDrafts] = useState<PostDraft[]>([]);
	const [draftNote, setDraftNote] = useState<string | null>(null);

	const [need, setNeed] = useState<NeedFieldsValue>(EMPTY_NEED);
	const [event, setEvent] = useState<EventFieldsValue>(emptyEvent);
	const [announcement, setAnnouncement] =
		useState<AnnouncementFieldsValue>(EMPTY_ANNOUNCEMENT);

	const patchNeed = useCallback(
		(patch: Partial<NeedFieldsValue>) =>
			setNeed((current) => ({ ...current, ...patch })),
		[],
	);
	const patchEvent = useCallback(
		(patch: Partial<EventFieldsValue>) =>
			setEvent((current) => ({ ...current, ...patch })),
		[],
	);
	const patchAnnouncement = useCallback(
		(patch: Partial<AnnouncementFieldsValue>) =>
			setAnnouncement((current) => ({ ...current, ...patch })),
		[],
	);

	const [city, setCity] = useState("");
	const [state, setState] = useState("");
	const homeCity = org.data?.city ?? null;
	const stateOnFile = !!org.data?.state?.trim();
	const draftId = useRef(newDraftId());

	const copy = COPY[type];
	// Filled canvas inputs - the fill is what separates the writing surface
	// from the sheet behind it on desktop.
	const canvasBox = {
		borderWidth: 1,
		borderColor: colors.border.hairline,
		backgroundColor: colors.background.tertiary,
		borderRadius: borderRadius.md,
		paddingHorizontal: spacing[3.5],
	} as const;
	const isUpdate = type === "POST";
	const composed = composePostText(headline, text);
	const bodyLength = isUpdate ? composed.length : text.trim().length;
	const remaining = copy.bodyMax - bodyLength;
	const hasBody = text.trim().length > 0;
	const hasTitle = headline.trim().length > 0;
	const saving =
		publish.isPending ||
		createNeed.isPending ||
		createEvent.isPending ||
		createAnnouncement.isPending;
	const canPost = hasTitle && hasBody && remaining >= 0 && !saving;
	const uploading = saving && media.length > 0;
	const uploadedCount = media.filter(
		(file) => file.status === "uploaded",
	).length;
	const atMediaCap = media.length >= MAX_FEED_MEDIA;

	/* ---- Media ---- */

	const patchMedia = useCallback(
		(id: string, patch: Partial<ComposerMedia>) => {
			setMedia((current) =>
				current.map((file) => (file.id === id ? { ...file, ...patch } : file)),
			);
		},
		[],
	);

	const pickMedia = useCallback(
		async (kind: "all" | "video" = "all") => {
			if (media.length >= MAX_FEED_MEDIA) return;
			setRejected([]);
			setFormError(null);
			setPanel("none");
			setPickerBusy(true);
			try {
				const result = await ImagePicker.launchImageLibraryAsync({
					mediaTypes: kind === "video" ? ["videos"] : ["images", "videos"],
					allowsMultipleSelection: true,
					selectionLimit: MAX_FEED_MEDIA - media.length,
					orderedSelection: true,
					quality: 0.85,
				});
				if (result.canceled) return;
				const { accepted, rejected: refused } = toComposerMedia(
					result.assets,
					media.length,
				);
				if (accepted.length > 0) setMedia((c) => [...c, ...accepted]);
				setRejected(refused);
			} catch (error) {
				setFormError(
					error instanceof Error
						? error.message
						: "Could not open your photo library.",
				);
			} finally {
				setPickerBusy(false);
			}
		},
		[media.length],
	);

	const removeMedia = (id: string) => {
		setMedia((current) => current.filter((file) => file.id !== id));
		setRejected([]);
	};

	/* ---- Drafts (Updates only - the store budget fits text, not metadata) ---- */

	const persist = useCallback(async (next: PostDraft[]) => {
		const result = await saveDrafts(next);
		setDrafts(result.drafts);
		setDraftNote(
			result.tooLarge
				? "Too long to keep on this device - it stays here until you post."
				: result.evicted > 0
					? `Kept the newest ${result.drafts.length}. Older drafts made way.`
					: null,
		);
	}, []);

	const saveCurrentDraft = useCallback(async () => {
		if (!hasBody && !hasTitle) return;
		if (type !== "POST") return;
		const draft: PostDraft = {
			id: draftId.current,
			tag: "POST",
			isUrgent: urgent,
			title: headline,
			body: text,
			savedAt: new Date().toISOString(),
		};
		await persist([draft, ...drafts.filter((row) => row.id !== draft.id)]);
	}, [hasBody, hasTitle, type, urgent, headline, text, drafts, persist]);

	const restoreDraft = (draft: PostDraft) => {
		draftId.current = draft.id;
		setType(toComposerType(draft.tag));
		setUrgent(draft.isUrgent ?? toComposerUrgent(draft.tag));
		setHeadline(draft.title);
		setText(draft.body);
		setPanel("none");
		setDraftNote(null);
		setErrors({});
	};

	/* ---- Open / close (dismissal keeps everything; publish clears) ---- */

	const wasOpen = useRef(false);
	useEffect(() => {
		if (visible && !wasOpen.current) {
			wasOpen.current = true;
			setFormError(null);
			setRejected([]);
			setPanel(openDraftsOnMount ? "drafts" : "none");
			setErrors({});
			setCity((c) => c || (org.data?.city ?? ""));
			setState((s) => s || (org.data?.state ?? ""));
			if (openPickerOnMount && isVerified) {
				queueMicrotask(() => void pickMedia());
			}
			void loadDrafts().then(setDrafts);
			return;
		}
		if (!visible && wasOpen.current) {
			wasOpen.current = false;
			void saveCurrentDraft();
		}
	}, [
		visible,
		initialTag,
		openPickerOnMount,
		openDraftsOnMount,
		isVerified,
		org.data?.city,
		org.data?.state,
		pickMedia,
		saveCurrentDraft,
	]);

	/* ---- Reference an existing need / event from an Update ---- */

	const canReference = isUpdate;
	const needs = useOrgNeeds({ limit: 8 }, visible && referenceOpen);
	const events = useOrgEvents({ limit: 8 }, visible && referenceOpen);

	const references = useMemo(() => {
		const openNeeds = (needs.data?.items ?? [])
			.filter((row) => row.status === "OPEN")
			.map((row) => ({
				id: row.id,
				title: row.title,
				hint: formatProgress(row.fulfilledQuantity, row.quantity, row.unit),
			}));
		const publishedEvents = (events.data?.items ?? [])
			.filter((row) => row.status === "PUBLISHED")
			.map((row) => ({
				id: row.id,
				title: row.title,
				hint: formatDateRange(row.startAt, row.endAt),
			}));
		return [...openNeeds, ...publishedEvents];
	}, [needs.data, events.data]);

	const appendReference = (title: string, hint: string) => {
		const line = `↳ ${title}${hint ? ` - ${hint}` : ""}`;
		setText((current) =>
			current.trim() ? `${current.trim()}\n\n${line}` : line,
		);
		setReferenceOpen(false);
	};

	/* ---- Publish ---- */

	/**
	 * Clears the composer and closes it, then says what was published and
	 * where it went. It used to only close: the drawer vanished and nothing on
	 * the screen behind it said the post existed - the exact "screen just
	 * blinks" case in `apps/native/AGENTS.md`. `view` opens the list the new
	 * row lives in, for the types that have one.
	 */
	const finish = async (message: string, view?: string) => {
		await persist(drafts.filter((row) => row.id !== draftId.current));
		draftId.current = newDraftId();
		setHeadline("");
		setText("");
		setMedia([]);
		setRejected([]);
		setReferenceOpen(false);
		setDraftNote(null);
		setErrors({});
		setUrgent(false);
		setNeed(EMPTY_NEED);
		setEvent(emptyEvent());
		setAnnouncement(EMPTY_ANNOUNCEMENT);
		onClose();
		toast.success(
			message,
			view
				? { label: "View", onPress: () => router.push(view as never) }
				: undefined,
		);
	};

	const applyIssues = (issues: { path: PropertyKey[]; message: string }[]) => {
		const next: Record<string, string> = {};
		for (const issue of issues) {
			const key = String(issue.path[0] ?? "form");
			if (!next[key]) next[key] = issue.message;
		}
		return next;
	};

	const onSubmit = async () => {
		if (!canPost) return;
		setFormError(null);
		setErrors({});
		setPanel("none");

		const onError = (error: unknown) => setFormError(apiErrorMessage(error));
		const title = headline.trim();
		const body = text.trim();
		const placeCity = (city.trim() || homeCity || "").trim();
		const placeState = stateOnFile
			? (org.data?.state ?? "").trim()
			: state.trim();

		// Retry re-uploads the whole set: intent folders are minted per attempt.
		const fresh = media.map((file) => ({
			...file,
			status: "ready" as const,
			progress: 0,
			objectKey: undefined,
			error: undefined,
		}));
		setMedia(fresh);
		let uploaded: Awaited<ReturnType<typeof uploadFeedMedia>> | null = null;
		try {
			uploaded =
				fresh.length > 0 ? await uploadFeedMedia(fresh, patchMedia) : null;
		} catch (error) {
			onError(error);
			return;
		}
		const coverImage = uploaded?.mediaKeys[0];

		if (type === "NEED") {
			// "0" is the bar's resting state for "unspecified" - never sent.
			const quantity =
				need.quantity && Number(need.quantity) > 0
					? Number(need.quantity)
					: undefined;
			const parsed = createNeedSchema.safeParse({
				type: need.needType,
				title,
				description: body,
				...(coverImage ? { coverImage } : {}),
				...(quantity !== undefined ? { quantity } : {}),
				unit: need.unit.trim(),
				urgency: urgent ? "HIGH" : "MEDIUM",
				city: placeCity,
				state: placeState,
				...(need.expiresAt ? { expiresAt: need.expiresAt } : {}),
			});
			if (!parsed.success) {
				setErrors(applyIssues(parsed.error.issues));
				return;
			}
			createNeed.mutate(parsed.data as CreateNeedInput, {
				onSuccess: () =>
					void finish(
						need.needType === "OFFER"
							? "Offer published - it's on the feed."
							: "Need published - it's on the feed.",
						"/(ngo)/needs",
					),
				onError,
			});
			return;
		}

		if (type === "EVENT") {
			const parsed = createEventSchema.safeParse({
				title,
				description: body,
				venue: event.venueOpen ? event.venue.trim() : "",
				address: event.addressOpen ? event.address.trim() : "",
				city: placeCity,
				state: placeState,
				startAt: event.startAt,
				endAt: event.endAt,
				...(event.deadline ? { applicationDeadline: event.deadline } : {}),
				...(coverImage ? { coverImage } : {}),
				volunteersNeeded: event.volunteers
					? Number(event.volunteers)
					: undefined,
				status: "PUBLISHED",
				isUrgent: urgent,
			});
			if (!parsed.success) {
				const next = applyIssues(parsed.error.issues);
				if (!event.startAt) next.startAt = "Enter a start date and time";
				if (!event.endAt) next.endAt = "Enter an end date and time";
				if (!event.volunteers)
					next.volunteersNeeded = "How many volunteers do you need?";
				setErrors(next);
				return;
			}
			createEvent.mutate(parsed.data as CreateEventInput, {
				onSuccess: () =>
					void finish(
						"Event published - volunteers can apply now.",
						"/(ngo)/events",
					),
				onError,
			});
			return;
		}

		if (type === "ANNOUNCEMENT") {
			const parsed = upsertAnnouncementSchema.safeParse({
				title,
				body,
				status: "PUBLISHED",
				isPinned: announcement.pinned,
				isUrgent: urgent,
				...(coverImage ? { coverImageKey: coverImage } : {}),
			});
			if (!parsed.success) {
				setErrors(applyIssues(parsed.error.issues));
				return;
			}
			createAnnouncement.mutate(parsed.data as UpsertAnnouncementInput, {
				onSuccess: () =>
					void finish("Announcement published.", "/(ngo)/announcements"),
				onError,
			});
			return;
		}

		if (title.length < TITLE_MIN) {
			setErrors({
				title: `Headline needs at least ${TITLE_MIN} characters`,
			});
			return;
		}

		publish.mutate(
			{
				text: composed,
				type: "POST",
				isUrgent: urgent,
				media: fresh,
				onMediaChange: patchMedia,
				uploaded,
			},
			{ onSuccess: () => void finish("Update posted to the feed."), onError },
		);
	};

	/* ---- Unverified gate ---- */

	if (!isVerified) {
		return (
			<Drawer
				visible={visible}
				onClose={onClose}
				title="New post"
				subtitle={orgName}
				footer={
					<Button
						onPress={() => {
							onClose();
							router.push("/(ngo)/verification");
						}}
					>
						Go to verification
					</Button>
				}
			>
				<View style={{ gap: spacing[3] }}>
					<Banner
						tone="warning"
						title="Verification unlocks posting"
						description="Posting opens once a reviewer has approved your registration certificate and PAN card."
					/>
					<Caption color="tertiary">
						You can still draft events from the Events screen - only publishing
						them waits on the review. Needs and updates go public the moment
						they are posted, so they wait too.
					</Caption>
				</View>
			</Drawer>
		);
	}

	if (roleBlocked) {
		return (
			<Drawer
				visible={visible}
				onClose={onClose}
				title="New post"
				subtitle={orgName}
				footer={
					<Button variant="outline" onPress={onClose}>
						Close
					</Button>
				}
			>
				<Banner
					tone="info"
					title="Publishing isn't open to you"
					description={roleBlocked}
				/>
			</Drawer>
		);
	}

	/* ---- Footer status line ---- */

	const status: string | null = formError
		? null
		: !hasTitle && hasBody
			? "Add a headline - the feed has nothing to show without one."
			: !hasBody && media.length > 0
				? "Add a line of text, even with photos."
				: atMediaCap
					? `${MAX_FEED_MEDIA} of ${MAX_FEED_MEDIA} attached - remove one to add another.`
					: null;

	const activeLabel =
		TYPES.find((item) => item.value === type)?.label ?? "Update";

	return (
		<Drawer
			visible={visible}
			onClose={onClose}
			wide
			title={`New ${activeLabel.toLowerCase()}`}
			subtitle={`${orgName} · Public`}
			footer={
				<ComposerFooter
					status={status}
					draftNote={draftNote}
					remaining={remaining}
					showCount={remaining <= COUNTER_AT}
					uploading={uploading}
					uploadedLabel={`${Math.min(uploadedCount + 1, media.length)}/${media.length}`}
					isUpdate={isUpdate}
					canReference={canReference}
					atMediaCap={atMediaCap}
					saving={saving}
					pickerBusy={pickerBusy}
					referenceOpen={referenceOpen}
					panel={panel}
					draftsCount={drafts.length}
					canPost={canPost}
					submitLabel={isUpdate ? "Post" : "Publish"}
					onPickAll={() => pickMedia("all")}
					onPickVideo={() => pickMedia("video")}
					onToggleReference={() => setReferenceOpen((o) => !o)}
					onToggleDrafts={() =>
						setPanel(panel === "drafts" ? "none" : "drafts")
					}
					onSubmit={onSubmit}
				/>
			}
		>
			<View>
				{/* 1 · Type */}
				<SectionTitle>Post type</SectionTitle>
				<ChoiceChips
					label="Post type"
					options={TYPES.map(({ value, label, hint }) => ({
						value,
						label,
						hint,
					}))}
					value={type}
					onChange={(next) => {
						setType(next);
						setReferenceOpen(false);
						setPanel("none");
						setErrors({});
					}}
				/>

				<Divider />

				{/* 2 · Content */}
				<SectionTitle>Content</SectionTitle>
				<Label color="tertiary" style={{ marginBottom: spacing[1.5] }}>
					{copy.headlineLabel}
				</Label>
				<Input
					placeholder={copy.headlinePlaceholder}
					value={headline}
					onChangeText={(value) => {
						setHeadline(value);
						if (errors.title) setErrors(({ title: _, ...rest }) => rest);
					}}
					maxLength={HEADLINE_MAX}
					editable={!saving}
					accessibilityLabel={copy.headlineLabel}
					style={{
						...canvasBox,
						// A TextInput cannot take a ramp component, so the headline
						// reads the H5 step's size from the tokens instead.
						fontSize: typography.fontSize.xl,
						lineHeight: 24,
						fontFamily: typography.fontFamily.sansMedium,
						paddingVertical: spacing[3],
					}}
				/>
				<FieldError message={errors.title} />

				<View style={{ height: spacing[3] }} />

				<Label color="tertiary" style={{ marginBottom: spacing[1.5] }}>
					{copy.bodyLabel}
				</Label>
				<Input
					placeholder={copy.bodyPlaceholder}
					value={text}
					onChangeText={(value) => {
						setText(value);
						if (errors.description || errors.body)
							setErrors(({ description: _d, body: _b, ...rest }) => rest);
					}}
					multiline
					editable={!saving}
					accessibilityLabel={copy.bodyLabel}
					style={{
						...canvasBox,
						lineHeight: 23,
						textAlignVertical: "top",
						paddingVertical: spacing[3],
						minHeight: isUpdate ? 148 : 108,
					}}
				/>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						gap: spacing[2],
						marginTop: spacing[1],
					}}
				>
					<Caption color="quaternary" style={{ flex: 1 }}>
						{errors.description ?? errors.body ?? copy.bodyHint}
					</Caption>
					<Caption
						color={remaining < 0 ? colors.error.ink : "quaternary"}
						weight={remaining < 0 ? "semibold" : "normal"}
					>
						{bodyLength}/{copy.bodyMax}
					</Caption>
				</View>

				<Divider />

				{/* 3 · Details */}
				<SectionTitle>Details</SectionTitle>
				{type !== "NEED" && (
					<SwitchRow
						icon={AlertTriangle}
						tone="error"
						title="Mark as urgent"
						hint="Urgent posts rank higher and appear in the Urgent lens. Use sparingly."
						value={urgent}
						onChange={setUrgent}
						disabled={saving}
					/>
				)}
				{type === "NEED" && (
					<NeedFields
						value={need}
						onChange={patchNeed}
						urgent={urgent}
						onUrgent={setUrgent}
						city={city}
						state={state}
						onCity={setCity}
						onState={setState}
						homeCity={homeCity}
						stateOnFile={stateOnFile}
						errors={errors}
						disabled={saving}
					/>
				)}
				{type === "EVENT" && (
					<EventFields
						value={event}
						onChange={patchEvent}
						city={city}
						state={state}
						onCity={setCity}
						onState={setState}
						homeCity={homeCity}
						homeAddress={org.data?.address ?? null}
						stateOnFile={stateOnFile}
						errors={errors}
						disabled={saving}
					/>
				)}
				{type === "ANNOUNCEMENT" && (
					<AnnouncementFields
						value={announcement}
						onChange={patchAnnouncement}
						disabled={saving}
					/>
				)}

				{/* 4 · Media */}
				{media.length > 0 && (
					<View style={{ marginTop: spacing[5] }}>
						<SectionTitle
							action={
								<Caption color={atMediaCap ? colors.warning.ink : "quaternary"}>
									{media.length} of {MAX_FEED_MEDIA}
								</Caption>
							}
						>
							Photos and video
						</SectionTitle>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{
								gap: spacing[2],
								paddingRight: spacing[1],
							}}
						>
							{media.map((file, index) => (
								<MediaTile
									key={file.id}
									file={file}
									ordinal={index + 1}
									locked={publish.isPending}
									onRemove={() => removeMedia(file.id)}
								/>
							))}
							{!atMediaCap && (
								<AddTile
									busy={pickerBusy}
									disabled={saving}
									onPress={() => pickMedia("all")}
								/>
							)}
						</ScrollView>
						<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
							{MEDIA_RULES}
						</Caption>
					</View>
				)}

				{rejected.length > 0 && (
					<View style={{ marginTop: spacing[3], gap: spacing[1.5] }}>
						{rejected.map((item) => (
							<RejectedRow
								key={`${item.fileName}-${item.reason}`}
								fileName={item.fileName}
								reason={item.reason}
							/>
						))}
					</View>
				)}

				{panel === "drafts" && (
					<View style={{ marginTop: spacing[4] }}>
						<DraftsPanel
							drafts={drafts}
							hasContent={hasBody || hasTitle}
							onRestore={restoreDraft}
							onDiscard={(id) =>
								void persist(drafts.filter((row) => row.id !== id))
							}
							onSave={() => void saveCurrentDraft()}
						/>
					</View>
				)}

				{referenceOpen && canReference && (
					<View style={{ marginTop: spacing[5] }}>
						<SectionTitle>Your open needs and events</SectionTitle>
						{references.length === 0 ? (
							<Caption color="quaternary">
								{needs.isLoading || events.isLoading
									? "Loading…"
									: "Nothing open to mention yet. Publish a need or an event first."}
							</Caption>
						) : (
							<View style={{ gap: spacing[2] }}>
								{references.map((reference) => (
									<Pressable
										key={reference.id}
										onPress={() =>
											appendReference(reference.title, reference.hint)
										}
										accessibilityRole="button"
										accessibilityLabel={`Mention ${reference.title}`}
										{...focusable}
										style={({ pressed, hovered }) => ({
											flexDirection: "row",
											alignItems: "center",
											gap: spacing[3],
											minHeight: 48,
											paddingHorizontal: spacing[3],
											borderRadius: borderRadius.md,
											backgroundColor:
												pressed || hovered
													? colors.background.subtle
													: colors.background.tertiary,
										})}
									>
										<View style={{ flex: 1, minWidth: 0 }}>
											<Label numberOfLines={1}>{reference.title}</Label>
											<Caption color="quaternary" numberOfLines={1}>
												{reference.hint}
											</Caption>
										</View>
										<Plus
											size={16}
											color={colors.text.tertiary as string}
											strokeWidth={2}
										/>
									</Pressable>
								))}
							</View>
						)}
					</View>
				)}

				{formError && (
					<View style={{ marginTop: spacing[4] }}>
						<Banner
							tone="error"
							title="Could not publish"
							description={formError}
						/>
					</View>
				)}
			</View>
		</Drawer>
	);
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

function Divider() {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				height: 1,
				marginVertical: spacing[5],
				backgroundColor: colors.border.hairline,
			}}
		/>
	);
}

function RejectedRow({
	fileName,
	reason,
}: {
	fileName: string;
	reason: string;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "flex-start",
				gap: spacing[2],
			}}
		>
			<AlertTriangle
				size={13}
				color={colors.warning.ink as string}
				strokeWidth={2.2}
				style={{ marginTop: 2 }}
			/>
			<Caption color="secondary" style={{ flex: 1 }}>
				<Caption weight="semibold">{fileName}</Caption> - {reason}
			</Caption>
		</View>
	);
}

function DraftsPanel({
	drafts,
	hasContent,
	onRestore,
	onDiscard,
	onSave,
}: {
	drafts: PostDraft[];
	hasContent: boolean;
	onRestore: (draft: PostDraft) => void;
	onDiscard: (id: string) => void;
	onSave: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();
	return (
		<InlinePanel>
			<View style={{ gap: spacing[2] }}>
				<SectionTitle
					action={
						hasContent ? (
							<Pressable
								onPress={onSave}
								accessibilityRole="button"
								accessibilityLabel="Save this draft"
								hitSlop={8}
								style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
							>
								<Caption weight="medium" color={colors.primary.ink}>
									Save current
								</Caption>
							</Pressable>
						) : undefined
					}
				>
					Drafts
				</SectionTitle>
				{drafts.length === 0 ? (
					<Caption color="tertiary">
						Nothing saved yet. Closing the composer keeps your words here.
					</Caption>
				) : (
					drafts.map((draft) => (
						<View
							key={draft.id}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[2],
							}}
						>
							<Pressable
								onPress={() => onRestore(draft)}
								accessibilityRole="button"
								accessibilityLabel={`Open draft: ${draftPreview(draft)}`}
								{...focusable}
								style={({ pressed, hovered }) => ({
									flex: 1,
									minWidth: 0,
									minHeight: 48,
									justifyContent: "center",
									paddingHorizontal: spacing[3],
									borderRadius: borderRadius.md,
									backgroundColor:
										pressed || hovered
											? colors.background.tertiary
											: colors.background.card,
								})}
							>
								<Label numberOfLines={1}>
									{draftPreview(draft) || "Untitled"}
								</Label>
								<Caption color="quaternary" numberOfLines={1}>
									{draft.isUrgent || draft.tag === "URGENT" ? "Urgent · " : ""}
									{formatRelative(draft.savedAt)}
								</Caption>
							</Pressable>
							<IconPill
								icon={Trash2}
								label={`Discard draft: ${draftPreview(draft)}`}
								onPress={() => onDiscard(draft.id)}
							/>
						</View>
					))
				)}
				<Caption color="quaternary">Drafts stay on this device only.</Caption>
			</View>
		</InlinePanel>
	);
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function ComposerFooter({
	status,
	draftNote,
	remaining,
	showCount,
	uploading,
	uploadedLabel,
	isUpdate,
	canReference,
	atMediaCap,
	saving,
	pickerBusy,
	referenceOpen,
	panel,
	draftsCount,
	canPost,
	submitLabel,
	onPickAll,
	onPickVideo,
	onToggleReference,
	onToggleDrafts,
	onSubmit,
}: {
	status: string | null;
	draftNote: string | null;
	remaining: number;
	showCount: boolean;
	uploading: boolean;
	uploadedLabel: string;
	isUpdate: boolean;
	canReference: boolean;
	atMediaCap: boolean;
	saving: boolean;
	pickerBusy: boolean;
	referenceOpen: boolean;
	panel: Panel;
	draftsCount: number;
	canPost: boolean;
	submitLabel: string;
	onPickAll: () => void;
	onPickVideo: () => void;
	onToggleReference: () => void;
	onToggleDrafts: () => void;
	onSubmit: () => void;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View style={{ gap: spacing[2] }}>
			{draftNote && <Caption color="quaternary">{draftNote}</Caption>}
			{status && (
				<Caption color="quaternary" numberOfLines={2}>
					{status}
				</Caption>
			)}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: spacing[1.5],
				}}
			>
				<Tool
					icon={ImagePlus}
					tip="Add photos"
					label={atMediaCap ? "Add photos - limit reached" : "Add photos"}
					disabled={atMediaCap || saving}
					busy={pickerBusy}
					onPress={onPickAll}
				/>
				<Tool
					icon={Video}
					tip="Add a video"
					label="Add a video"
					disabled={atMediaCap || saving}
					onPress={onPickVideo}
				/>
				<Tool
					icon={Link2}
					tip="Mention a need or event"
					label={
						canReference
							? "Mention one of your needs or events"
							: "Mentions go on an Update"
					}
					disabled={!canReference || saving}
					active={referenceOpen}
					onPress={onToggleReference}
				/>
				<Tool
					icon={FileClock}
					tip={draftsCount > 0 ? `Drafts · ${draftsCount}` : "Drafts"}
					label={
						!isUpdate
							? "Drafts - only Updates are kept"
							: draftsCount > 0
								? `Drafts, ${draftsCount}`
								: "Drafts"
					}
					badge={draftsCount}
					active={panel === "drafts"}
					disabled={!isUpdate || saving}
					onPress={onToggleDrafts}
				/>
				<View style={{ flex: 1 }} />
				{uploading ? (
					<Caption color="quaternary">{uploadedLabel}</Caption>
				) : showCount ? (
					<Caption
						color={remaining < 0 ? colors.error.ink : "quaternary"}
						weight={remaining < 0 ? "semibold" : "normal"}
					>
						{remaining}
					</Caption>
				) : null}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[1.5],
						marginLeft: spacing[2],
					}}
				>
					<Tool
						icon={Clock}
						tip="Scheduling needs a server update"
						label="Schedule - not available yet"
						disabled
						onPress={() => {}}
					/>
					<Button
						size="sm"
						onPress={onSubmit}
						loading={saving}
						disabled={!canPost}
					>
						{submitLabel}
					</Button>
				</View>
			</View>
		</View>
	);
}
