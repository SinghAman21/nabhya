import { type CreateEventInput, createEventSchema } from "@nabhya/shared";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { DateTimeField } from "@/components/date-time-field";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { FormFooterRow, useFormButtonGrow } from "@/components/ngo/form-footer";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import {
	useCreateEvent,
	useOrgEvent,
	useUpdateEvent,
} from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { OrgEventListItem } from "@/lib/types";

interface Draft {
	title: string;
	description: string;
	venue: string;
	address: string;
	city: string;
	state: string;
	startAt?: Date;
	endAt?: Date;
	volunteersNeeded: string;
}

/**
 * Create or edit an event.
 *
 * Dates come from DateTimeField rather than react-hook-form, so this validates
 * the assembled payload against the shared schema in one pass and maps Zod's
 * field errors back onto the inputs.
 *
 * Passing `event` switches to edit mode, which is the only way to publish a
 * draft - without it a draft is a permanent dead end.
 */
export function EventFormSheet({
	visible,
	onClose,
	defaultCity,
	defaultState,
	event,
	publishBlockedReason = null,
}: {
	visible: boolean;
	onClose: () => void;
	defaultCity?: string | null;
	defaultState?: string | null;
	/** Omit to create; supply to edit. */
	event?: OrgEventListItem | null;
	/**
	 * Why this person cannot publish (unverified NGO, or a team role without
	 * `content.publish`) - from `useOrgAccess().blocked`. When set, the sheet
	 * saves drafts only and says why, instead of offering a Publish button the
	 * server would refuse.
	 */
	publishBlockedReason?: string | null;
}) {
	const { spacing } = useTheme();
	const grow = useFormButtonGrow();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(120);
	const createEvent = useCreateEvent();
	const updateEvent = useUpdateEvent();
	const isEditing = !!event;
	// The list item lacks description/venue/address; fetch the full event so an
	// edit doesn't wipe those fields.
	const { data: detail, isLoading: loadingDetail } = useOrgEvent(
		visible && event ? event.id : undefined,
	);

	const emptyDraft: Draft = {
		title: "",
		description: "",
		venue: "",
		address: "",
		city: defaultCity ?? "",
		state: defaultState ?? "",
		volunteersNeeded: "",
	};

	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const [errors, setErrors] = useState<Record<string, string>>({});
	// Which footer button is spinning - only the one that was pressed.
	const [savingAs, setSavingAs] = useState<"DRAFT" | "PUBLISHED">("PUBLISHED");

	// Load the event being edited. Keyed on id so reopening the sheet for a
	// different event replaces the form rather than keeping the last one. Prefers
	// the full detail (description/venue/address) once it loads, falling back to
	// the summary list item so the form isn't empty while the request is in
	// flight.
	useEffect(() => {
		if (!event) return;
		setDraft({
			title: detail?.title ?? event.title,
			description: detail?.description ?? "",
			venue: detail?.venue ?? "",
			address: detail?.address ?? "",
			city: detail?.city ?? event.city ?? "",
			state: detail?.state ?? event.state ?? "",
			startAt: new Date(detail?.startAt ?? event.startAt),
			endAt: new Date(detail?.endAt ?? event.endAt),
			volunteersNeeded: String(
				detail?.volunteersNeeded ?? event.volunteersNeeded,
			),
		});
		setErrors({});
	}, [event, detail]);

	// The initial draft is built on mount, usually before the organisation has
	// loaded, so a new event opened with no city or state. Fill the blanks from
	// the org when a fresh form opens.
	useEffect(() => {
		if (!visible || event) return;
		setDraft((d) =>
			(d.city || !defaultCity) && (d.state || !defaultState)
				? d
				: {
						...d,
						city: d.city || (defaultCity ?? ""),
						state: d.state || (defaultState ?? ""),
					},
		);
	}, [visible, event, defaultCity, defaultState]);

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	const close = () => {
		setDraft(emptyDraft);
		setErrors({});
		onClose();
	};

	const submit = (status: "DRAFT" | "PUBLISHED") => {
		const candidate = {
			title: draft.title,
			description: draft.description,
			venue: draft.venue || undefined,
			address: draft.address || undefined,
			city: draft.city,
			state: draft.state,
			startAt: draft.startAt,
			endAt: draft.endAt,
			volunteersNeeded: draft.volunteersNeeded,
			status,
		};

		const parsed = createEventSchema.safeParse(candidate);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? "form");
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			// Missing dates surface as "invalid input" from coerce.date(); say
			// something the organiser can act on instead.
			if (!draft.startAt) fieldErrors.startAt = "Enter a start date and time";
			if (!draft.endAt) fieldErrors.endAt = "Enter an end date and time";
			setErrors(fieldErrors);
			return;
		}

		setErrors({});
		setSavingAs(status);
		const onError = (error: unknown) =>
			setErrors({ form: apiErrorMessage(error) });

		if (isEditing && event) {
			updateEvent.mutate(
				{ id: event.id, input: parsed.data as CreateEventInput },
				{
					onSuccess: () => {
						toast.success(
							status === "DRAFT"
								? "Draft saved. Only your team can see it."
								: event.status === "DRAFT"
									? "Event published. Volunteers can apply now."
									: "Event updated.",
						);
						close();
					},
					onError,
				},
			);
			return;
		}

		createEvent.mutate(parsed.data as CreateEventInput, {
			onSuccess: () => {
				toast.success(
					status === "DRAFT"
						? "Draft saved. Only your team can see it."
						: "Event published. Volunteers can apply now.",
				);
				close();
			},
			onError,
		});
	};

	const saving = createEvent.isPending || updateEvent.isPending;
	// Block saving until the full event has loaded, so an edit can't submit the
	// blank description the form starts with.
	const blocked = saving || (isEditing && loadingDetail);
	const isDraft = !isEditing || event?.status === "DRAFT";

	return (
		<Drawer
			visible={visible}
			onClose={close}
			title={isEditing ? "Edit event" : "New event"}
			subtitle={
				isDraft
					? "Drafts stay private until you publish."
					: "Changes go live as soon as you save."
			}
			wide
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={errors.form} />
					{isDraft && publishBlockedReason ? (
						<FormFooterRow
							note={`Publishing: ${publishBlockedReason}`}
							primary={
								<Button
									onPress={() => submit("DRAFT")}
									loading={saving && savingAs === "DRAFT"}
									disabled={blocked}
									style={grow}
								>
									{isEditing ? "Save draft" : "Save as draft"}
								</Button>
							}
						/>
					) : (
						<FormFooterRow
							secondary={
								isDraft ? (
									<Button
										variant="outline"
										onPress={() => submit("DRAFT")}
										loading={saving && savingAs === "DRAFT"}
										disabled={blocked}
										style={grow}
									>
										{isEditing ? "Keep as draft" : "Save as draft"}
									</Button>
								) : undefined
							}
							primary={
								<Button
									onPress={() => submit("PUBLISHED")}
									loading={saving && savingAs === "PUBLISHED"}
									disabled={blocked}
									style={grow}
								>
									{isEditing && event?.status === "DRAFT"
										? "Publish this draft"
										: isEditing
											? "Save changes"
											: "Publish event"}
								</Button>
							}
						/>
					)}
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				<Field label="Event title" error={errors.title}>
					<Input
						placeholder="e.g. Beach cleanup drive"
						value={draft.title}
						onChangeText={(v) => set("title", v)}
						style={inputStyle}
					/>
				</Field>

				<Field label="What will volunteers do?" error={errors.description}>
					<Input
						placeholder="Describe the work, what to bring, and who to contact"
						value={draft.description}
						onChangeText={(v) => set("description", v)}
						multiline
						style={textAreaStyle}
					/>
				</Field>

				<DateTimeField
					label="Starts"
					value={draft.startAt}
					onChange={(v) => set("startAt", v)}
					error={errors.startAt}
				/>
				<DateTimeField
					label="Ends"
					value={draft.endAt}
					onChange={(v) => set("endAt", v)}
					error={errors.endAt}
					shortcuts={false}
				/>

				<Field
					label="Volunteers needed"
					error={errors.volunteersNeeded}
					hint="Applications close automatically once this many are accepted."
				>
					<Input
						placeholder="e.g. 25"
						value={draft.volunteersNeeded}
						onChangeText={(v) => set("volunteersNeeded", v.replace(/\D/g, ""))}
						keyboardType="number-pad"
						style={[inputStyle, { maxWidth: 160 }]}
					/>
				</Field>

				<Field label="Venue" optional error={errors.venue}>
					<Input
						placeholder="e.g. Juhu Beach, Gate 3"
						value={draft.venue}
						onChangeText={(v) => set("venue", v)}
						style={inputStyle}
					/>
				</Field>

				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<Field label="City" error={errors.city} style={{ flex: 1 }}>
						<Input
							placeholder="Mumbai"
							value={draft.city}
							onChangeText={(v) => set("city", v)}
							style={inputStyle}
						/>
					</Field>
					<Field label="State" error={errors.state} style={{ flex: 1 }}>
						<Input
							placeholder="Maharashtra"
							value={draft.state}
							onChangeText={(v) => set("state", v)}
							style={inputStyle}
						/>
					</Field>
				</View>
			</View>
		</Drawer>
	);
}
