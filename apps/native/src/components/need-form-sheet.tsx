import { zodResolver } from "@hookform/resolvers/zod";
import {
	type CreateNeedInput,
	createNeedSchema,
	type NeedType,
	type NeedUrgency,
} from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useCreateNeed, useUpdateNeed } from "@/hooks/use-needs";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { OrgNeedListItem } from "@/lib/types";

const TYPES: Array<{ value: NeedType; label: string; hint: string }> = [
	{
		value: "WANT",
		label: "We need something",
		hint: "Ask volunteers and donors to supply items or help",
	},
	{
		value: "OFFER",
		label: "We're giving something",
		hint: "Offer surplus items to the people who need them",
	},
];

const URGENCIES: Array<{ value: NeedUrgency; label: string }> = [
	{ value: "LOW", label: "Low" },
	{ value: "MEDIUM", label: "Medium" },
	{ value: "HIGH", label: "Urgent" },
];

/**
 * Create-a-post sheet for the NGO Needs tab. Validation comes straight from the
 * shared schema, so the inline errors match what the API would reject.
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
	const { colors, spacing } = useTheme();
	const createNeed = useCreateNeed();
	const updateNeed = useUpdateNeed();
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

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

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
		});
	}, [need, form, defaultState]);

	const close = () => {
		form.reset();
		onClose();
	};

	const onSubmit = form.handleSubmit((data) => {
		if (isEditing && need) {
			updateNeed.mutate(
				{ id: need.id, input: data },
				{
					onSuccess: close,
					onError: (error) =>
						Alert.alert("Could not save changes", apiErrorMessage(error)),
				},
			);
			return;
		}

		createNeed.mutate(data, {
			onSuccess: close,
			onError: (error) => Alert.alert("Could not post", apiErrorMessage(error)),
		});
	});

	const saving = createNeed.isPending || updateNeed.isPending;

	const type = form.watch("type");
	const urgency = form.watch("urgency");

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
					<H2>{isEditing ? "Edit post" : "New post"}</H2>
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
					<Label style={{ marginBottom: spacing[2] }}>Post type</Label>
					{TYPES.map((option) => {
						const active = type === option.value;
						return (
							<Pressable
								key={option.value}
								onPress={() =>
									form.setValue("type", option.value, { shouldValidate: true })
								}
								style={{
									backgroundColor: active
										? colors.primary.main
										: colors.background.primary,
									borderWidth: 1,
									borderColor: active
										? colors.primary.main
										: colors.border.light,
									borderRadius: 14,
									padding: spacing[4],
									marginBottom: spacing[2],
								}}
							>
								<Body
									weight="bold"
									color={
										active ? (colors.primary.contrast as string) : "primary"
									}
								>
									{option.label}
								</Body>
								<Caption
									color={
										active ? (colors.primary.contrast as string) : "tertiary"
									}
								>
									{option.hint}
								</Caption>
							</Pressable>
						);
					})}

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Title
					</Label>
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
					<FieldError message={form.formState.errors.title?.message} />

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
						Details
					</Label>
					<Input
						placeholder="Describe condition, sizes, pickup or drop-off, anything useful"
						value={form.watch("description")}
						onChangeText={(v) =>
							form.setValue("description", v, { shouldValidate: true })
						}
						multiline
						style={{ ...inputStyle, minHeight: 110, textAlignVertical: "top" }}
					/>
					<FieldError message={form.formState.errors.description?.message} />

					<View
						style={{
							flexDirection: "row",
							gap: spacing[3],
							marginTop: spacing[5],
						}}
					>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>
								Quantity <Caption color="tertiary">(optional)</Caption>
							</Label>
							<Input
								placeholder="200"
								value={
									form.watch("quantity") ? String(form.watch("quantity")) : ""
								}
								onChangeText={(v) =>
									form.setValue("quantity", v ? Number(v) : undefined, {
										shouldValidate: true,
									})
								}
								keyboardType="number-pad"
								style={inputStyle}
							/>
							<FieldError message={form.formState.errors.quantity?.message} />
						</View>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>Unit</Label>
							<Input
								placeholder="blankets"
								value={form.watch("unit") ?? ""}
								onChangeText={(v) =>
									form.setValue("unit", v, { shouldValidate: true })
								}
								style={inputStyle}
							/>
						</View>
					</View>

					<Label style={{ marginTop: spacing[5], marginBottom: spacing[2] }}>
						Urgency
					</Label>
					<View style={{ flexDirection: "row", gap: spacing[2] }}>
						{URGENCIES.map((option) => {
							const active = urgency === option.value;
							return (
								<Pressable
									key={option.value}
									onPress={() =>
										form.setValue("urgency", option.value, {
											shouldValidate: true,
										})
									}
									style={{
										flex: 1,
										alignItems: "center",
										paddingVertical: spacing[2.5],
										borderRadius: 12,
										backgroundColor: active
											? colors.primary.main
											: colors.background.tertiary,
									}}
								>
									<Body
										weight={active ? "bold" : "normal"}
										color={
											active ? (colors.primary.contrast as string) : "secondary"
										}
									>
										{option.label}
									</Body>
								</Pressable>
							);
						})}
					</View>

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
								value={form.watch("city")}
								onChangeText={(v) =>
									form.setValue("city", v, { shouldValidate: true })
								}
								style={inputStyle}
							/>
							<FieldError message={form.formState.errors.city?.message} />
						</View>
						<View style={{ flex: 1 }}>
							<Label style={{ marginBottom: spacing[1.5] }}>State</Label>
							<Input
								placeholder="Maharashtra"
								value={form.watch("state")}
								onChangeText={(v) =>
									form.setValue("state", v, { shouldValidate: true })
								}
								style={inputStyle}
							/>
							<FieldError message={form.formState.errors.state?.message} />
						</View>
					</View>

					<View style={{ height: spacing[8] }} />

					<Button onPress={onSubmit} loading={saving}>
						{isEditing ? "Save changes" : "Publish post"}
					</Button>
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
