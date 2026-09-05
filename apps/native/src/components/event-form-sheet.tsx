import { type CreateEventInput, createEventSchema } from "@nabhya/shared";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { DateTimeField } from "@/components/date-time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Caption, Label } from "@/components/ui/typography";
import {
	useCreateEvent,
	useOrgEvent,
	useUpdateEvent,
} from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
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
 * draft — without it a draft is a permanent dead end.
 */
export function EventFormSheet({
	visible,
	onClose,
	defaultCity,
	defaultState,
	event,
}: {
	visible: boolean;
	onClose: () => void;
	defaultCity?: string | null;
	defaultState?: string | null;
	/** Omit to create; supply to edit. */
	event?: OrgEventListItem | null;
}) {
	const { colors, spacing } = useTheme();
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

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

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

		if (isEditing && event) {
			updateEvent.mutate(
				{ id: event.id, input: parsed.data as CreateEventInput },
				{
					onSuccess: close,
					onError: (error) =>
						Alert.alert("Could not save changes", apiErrorMessage(error)),
				},
			);
			return;
		}

		createEvent.mutate(parsed.data as CreateEventInput, {
			onSuccess: close,
			onError: (error) =>
				Alert.alert("Could not create event", apiErrorMessage(error)),
		});
	};

	const saving = createEvent.isPending || updateEvent.isPending;
	// Block saving until the full event has loaded, so an edit can't submit the
	// blank description the form starts with.
	const blocked = saving || (isEditing && loadingDetail);

	return (
		<Sheet
			visible={visible}
			onClose={close}
			title={isEditing ? "Edit event" : "New event"}
			footer={
				<>
					<Button
						onPress={() => submit("PUBLISHED")}
						loading={saving}
						disabled={blocked}
					>
						{isEditing && event?.status === "DRAFT"
							? "Publish this draft"
							: isEditing
								? "Save changes"
								: "Publish event"}
					</Button>
					{(!isEditing || event?.status === "DRAFT") && (
						<Button
							variant="outline"
							onPress={() => submit("DRAFT")}
							disabled={blocked}
							style={{ marginTop: spacing[2] }}
						>
							{isEditing ? "Keep as draft" : "Save as draft"}
						</Button>
					)}
				</>
			}
		>
			<Label style={{ marginBottom: spacing[1.5] }}>Event title</Label>
			<Input
				placeholder="e.g. Beach cleanup drive"
				value={draft.title}
				onChangeText={(v) => set("title", v)}
				style={inputStyle}
			/>
			<FieldError message={errors.title} />
			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				What will volunteers do?
			</Label>
			<Input
				placeholder="Describe the work, what to bring, and who to contact"
				value={draft.description}
				onChangeText={(v) => set("description", v)}
				multiline
				style={{ ...inputStyle, minHeight: 120, textAlignVertical: "top" }}
			/>
			<FieldError message={errors.description} />
			<View style={{ marginTop: spacing[5] }}>
				<DateTimeField
					label="Starts"
					value={draft.startAt}
					onChange={(v) => set("startAt", v)}
					error={errors.startAt}
				/>
			</View>
			<View style={{ marginTop: spacing[5] }}>
				<DateTimeField
					label="Ends"
					value={draft.endAt}
					onChange={(v) => set("endAt", v)}
					error={errors.endAt}
					shortcuts={false}
				/>
			</View>
			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Volunteers needed
			</Label>
			<Input
				placeholder="e.g. 25"
				value={draft.volunteersNeeded}
				onChangeText={(v) => set("volunteersNeeded", v.replace(/\D/g, ""))}
				keyboardType="number-pad"
				style={[inputStyle, { maxWidth: 160 }]}
			/>
			<FieldError message={errors.volunteersNeeded} />
			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Venue <Caption color="tertiary">(optional)</Caption>
			</Label>
			<Input
				placeholder="e.g. Juhu Beach, Gate 3"
				value={draft.venue}
				onChangeText={(v) => set("venue", v)}
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
					<Input
						placeholder="Mumbai"
						value={draft.city}
						onChangeText={(v) => set("city", v)}
						style={inputStyle}
					/>
					<FieldError message={errors.city} />
				</View>
				<View style={{ flex: 1 }}>
					<Label style={{ marginBottom: spacing[1.5] }}>State</Label>
					<Input
						placeholder="Maharashtra"
						value={draft.state}
						onChangeText={(v) => set("state", v)}
						style={inputStyle}
					/>
					<FieldError message={errors.state} />
				</View>
			</View>
		</Sheet>
	);
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
