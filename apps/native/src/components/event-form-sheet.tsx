import { type CreateEventInput, createEventSchema } from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { DateTimeField } from "@/components/date-time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, H2, Label } from "@/components/ui/typography";
import { useCreateEvent, useUpdateEvent } from "@/hooks/use-events";
import { useTheme } from "@/hooks/useTheme";
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
 * Create/edit-an-event sheet — pass `event` to edit an existing one.
 *
 * Dates come from DateTimeField rather than react-hook-form, so this validates
 * the assembled payload against the shared schema in one pass and maps Zod's
 * field errors back onto the inputs.
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
	event?: OrgEventListItem | null;
}) {
	const { colors, spacing } = useTheme();
	const createEvent = useCreateEvent();
	const updateEvent = useUpdateEvent();
	const saving = createEvent.isPending || updateEvent.isPending;

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

	// Re-seed the form whenever the sheet opens on a different event (or none).
	// biome-ignore lint/correctness/useExhaustiveDependencies: seed only on open/target change
	useEffect(() => {
		if (!visible) return;
		setErrors({});
		setDraft(
			event
				? {
						title: event.title,
						description: event.description,
						venue: event.venue ?? "",
						address: event.address ?? "",
						city: event.city ?? "",
						state: event.state ?? "",
						startAt: new Date(event.startAt),
						endAt: new Date(event.endAt),
						volunteersNeeded: String(event.volunteersNeeded),
					}
				: emptyDraft,
		);
	}, [visible, event?.id]);

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
		if (event) {
			updateEvent.mutate(
				{ id: event.id, input: parsed.data as CreateEventInput },
				{
					onSuccess: close,
					onError: (error) =>
						Alert.alert("Could not save changes", apiErrorMessage(error)),
				},
			);
		} else {
			createEvent.mutate(parsed.data as CreateEventInput, {
				onSuccess: close,
				onError: (error) =>
					Alert.alert("Could not create event", apiErrorMessage(error)),
			});
		}
	};

	const editingPublished = event?.status === "PUBLISHED";

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={close}
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
					<H2>{event ? "Edit event" : "New event"}</H2>
					<Pressable onPress={close} hitSlop={12}>
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

					<View style={{ height: spacing[8] }} />

					<Button
						onPress={() => submit("PUBLISHED")}
						loading={saving}
						style={{ marginBottom: spacing[3] }}
					>
						{editingPublished ? "Save changes" : "Publish event"}
					</Button>
					{!editingPublished && (
						<Button
							variant="outline"
							onPress={() => submit("DRAFT")}
							disabled={saving}
						>
							Save as draft
						</Button>
					)}
				</ScrollView>
			</View>
		</Modal>
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
