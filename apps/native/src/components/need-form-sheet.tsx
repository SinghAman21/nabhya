import { zodResolver } from "@hookform/resolvers/zod";
import {
	type CreateNeedInput,
	createNeedSchema,
	type NeedType,
	type NeedUrgency,
} from "@nabhya/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { ChoiceChips } from "@/components/choice-chips";
import { DateTimeField } from "@/components/date-time-field";
import { Field, FieldError, useFieldInputStyle } from "@/components/form-field";
import { FormFooterRow, useFormButtonGrow } from "@/components/ngo/form-footer";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/overlay";
import { useCreateNeed, useUpdateNeed } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import type { OrgNeedListItem } from "@/lib/types";

const TYPES: Array<{ value: NeedType; label: string; hint: string }> = [
	{
		value: "WANT",
		label: "We need",
		hint: "Ask volunteers and donors to supply items or help.",
	},
	{
		value: "OFFER",
		label: "We're giving",
		hint: "Offer surplus items to the people who need them.",
	},
];

const URGENCIES: Array<{ value: NeedUrgency; label: string; hint: string }> = [
	{ value: "LOW", label: "Low", hint: "Whenever someone can help." },
	{ value: "MEDIUM", label: "Medium", hint: "Needed in the coming weeks." },
	{
		value: "HIGH",
		label: "Urgent",
		hint: "Shown in the Urgent lens and ranked higher in every feed.",
	},
];

/**
 * Create or edit a need (or an offer) from the NGO Needs tab. Validation comes
 * straight from the shared schema, so the inline errors match what the API
 * would reject.
 *
 * A right-hand `Drawer` (`wide`) on desktop, with the needs list still
 * visible beside it, and a sheet on a phone; the action is pinned in the
 * footer and sized to its label (`FormFooterRow`). It was a centred dialog
 * with a full-width Publish bar.
 */
export function NeedFormSheet({
	visible,
	onClose,
	defaultCity,
	defaultState,
	need,
}: {
	visible: boolean;
	onClose: () => void;
	defaultCity?: string | null;
	defaultState?: string | null;
	/** Omit to create; supply to edit. */
	need?: OrgNeedListItem | null;
}) {
	const { spacing } = useTheme();
	const grow = useFormButtonGrow();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(110);
	const createNeed = useCreateNeed();
	const updateNeed = useUpdateNeed();
	const [formError, setFormError] = useState<string | null>(null);
	const isEditing = !!need;

	const form = useForm<CreateNeedInput>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(createNeedSchema as any),
		defaultValues: {
			type: "WANT",
			title: "",
			description: "",
			unit: "",
			urgency: "MEDIUM",
			city: defaultCity ?? "",
			state: defaultState ?? "",
		},
	});

	// Load the post being edited; keyed on id so reopening for a different post
	// replaces the form rather than keeping the previous one.
	useEffect(() => {
		if (!need) return;
		form.reset({
			type: need.type,
			title: need.title,
			description: need.description,
			quantity: need.quantity ?? undefined,
			unit: need.unit ?? "",
			urgency: need.urgency,
			city: need.city ?? "",
			state: defaultState ?? "",
			expiresAt: need.expiresAt ? new Date(need.expiresAt) : undefined,
		});
		setFormError(null);
	}, [need, form, defaultState]);

	// `defaultValues` is read once, on mount - and the sheet mounts with its
	// screen, before the organisation has loaded, so a new need opened with an
	// empty city and state and failed with "City is required". Fill them from
	// the org whenever a fresh form opens with them still blank.
	useEffect(() => {
		if (!visible || need) return;
		if (!form.getValues("city") && defaultCity) {
			form.setValue("city", defaultCity);
		}
		if (!form.getValues("state") && defaultState) {
			form.setValue("state", defaultState);
		}
	}, [visible, need, defaultCity, defaultState, form]);

	const close = () => {
		form.reset();
		setFormError(null);
		onClose();
	};

	const onSubmit = form.handleSubmit((data) => {
		setFormError(null);
		const onError = (error: unknown) => setFormError(apiErrorMessage(error));

		if (isEditing && need) {
			updateNeed.mutate(
				{ id: need.id, input: data },
				{
					onSuccess: () => {
						toast.success("Post updated.");
						close();
					},
					onError,
				},
			);
			return;
		}
		createNeed.mutate(data, {
			onSuccess: () => {
				toast.success("Posted. It is live in the feed now.");
				close();
			},
			onError,
		});
	});

	const saving = createNeed.isPending || updateNeed.isPending;
	const errors = form.formState.errors;
	const type = form.watch("type");
	const urgency = form.watch("urgency");
	const quantity = form.watch("quantity");
	const expiresAt = form.watch("expiresAt");
	const noun = type === "OFFER" ? "offer" : "need";

	return (
		<Drawer
			visible={visible}
			onClose={close}
			wide
			title={isEditing ? `Edit ${noun}` : `New ${noun}`}
			subtitle={
				isEditing
					? "Changes go live as soon as you save."
					: "Volunteers see this in their feed straight away."
			}
			footer={
				<View style={{ gap: spacing[2] }}>
					<FieldError message={formError} />
					<FormFooterRow
						primary={
							<Button onPress={() => onSubmit()} loading={saving} style={grow}>
								{isEditing ? "Save changes" : `Publish ${noun}`}
							</Button>
						}
					/>
				</View>
			}
		>
			<View style={{ paddingTop: spacing[2] }}>
				<Field label="This post is" error={errors.type?.message}>
					<ChoiceChips
						label="Post type"
						options={TYPES}
						value={type}
						onChange={(value) =>
							form.setValue("type", value, { shouldValidate: true })
						}
					/>
				</Field>

				<Field label="Title" error={errors.title?.message}>
					<Input
						placeholder={
							type === "WANT"
								? "e.g. 200 winter blankets"
								: "e.g. 40 school desks"
						}
						value={form.watch("title")}
						onChangeText={(v) =>
							form.setValue("title", v, { shouldValidate: true })
						}
						style={inputStyle}
					/>
				</Field>

				<Field label="Details" error={errors.description?.message}>
					<Input
						placeholder="Condition, sizes, pickup or drop-off - anything a helper needs to know"
						value={form.watch("description")}
						onChangeText={(v) =>
							form.setValue("description", v, { shouldValidate: true })
						}
						multiline
						style={textAreaStyle}
					/>
				</Field>

				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<Field
						label="Quantity"
						optional
						error={errors.quantity?.message}
						style={{ flex: 1 }}
					>
						<Input
							placeholder="200"
							value={quantity ? String(quantity) : ""}
							onChangeText={(v) =>
								form.setValue(
									"quantity",
									v.replace(/\D/g, "")
										? Number(v.replace(/\D/g, ""))
										: undefined,
									{ shouldValidate: true },
								)
							}
							keyboardType="number-pad"
							style={inputStyle}
						/>
					</Field>
					<Field label="Unit" error={errors.unit?.message} style={{ flex: 1 }}>
						<Input
							placeholder="blankets"
							value={form.watch("unit") ?? ""}
							onChangeText={(v) =>
								form.setValue("unit", v, { shouldValidate: true })
							}
							style={inputStyle}
						/>
					</Field>
				</View>

				<Field label="Urgency" error={errors.urgency?.message}>
					<ChoiceChips
						label="Urgency"
						options={URGENCIES}
						value={urgency}
						onChange={(value) =>
							form.setValue("urgency", value, { shouldValidate: true })
						}
					/>
				</Field>

				<DateTimeField
					label="Closes on (optional)"
					value={expiresAt instanceof Date ? expiresAt : undefined}
					onChange={(next) =>
						form.setValue("expiresAt", next, { shouldValidate: true })
					}
					error={errors.expiresAt?.message}
					hint="Leave empty to keep it open until the target is met or you close it."
				/>

				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<Field label="City" error={errors.city?.message} style={{ flex: 1 }}>
						<Input
							placeholder="Mumbai"
							value={form.watch("city")}
							onChangeText={(v) =>
								form.setValue("city", v, { shouldValidate: true })
							}
							style={inputStyle}
						/>
					</Field>
					<Field
						label="State"
						error={errors.state?.message}
						style={{ flex: 1 }}
					>
						<Input
							placeholder="Maharashtra"
							value={form.watch("state")}
							onChangeText={(v) =>
								form.setValue("state", v, { shouldValidate: true })
							}
							style={inputStyle}
						/>
					</Field>
				</View>
			</View>
		</Drawer>
	);
}
