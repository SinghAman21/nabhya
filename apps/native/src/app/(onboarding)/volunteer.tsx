import { zodResolver } from "@hookform/resolvers/zod";
import {
	type VolunteerInterestsStep,
	type VolunteerLocationStep,
	type VolunteerProfileStep,
	volunteerInterestsStepSchema,
	volunteerLocationStepSchema,
	volunteerProfileStepSchema,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useCategories,
	useCompleteVolunteerOnboarding,
	useMe,
} from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

const STEPS = ["You", "Location", "Causes", "Done"];

interface VolunteerDraft {
	fullName: string;
	phone: string;
	city: string;
	state: string;
	bio: string;
	categoryIds: string[];
}

const emptyDraft: VolunteerDraft = {
	fullName: "",
	phone: "",
	city: "",
	state: "",
	bio: "",
	categoryIds: [],
};

/**
 * Volunteer counterpart to the NGO wizard — same step-indicator shell, same
 * per-step validation, one submit at the end.
 */
export default function VolunteerOnboarding() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [draft, setDraft] = useState<VolunteerDraft>(emptyDraft);
	const { data: me } = useMe();
	const complete = useCompleteVolunteerOnboarding();

	const merge = (fields: Partial<VolunteerDraft>) =>
		setDraft((d) => ({ ...d, ...fields }));

	const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
	const back = () => setStep((s) => Math.max(s - 1, 0));

	const submit = () => {
		complete.mutate(
			{
				fullName: draft.fullName,
				phone: draft.phone,
				city: draft.city,
				state: draft.state,
				bio: draft.bio || undefined,
				categoryIds: draft.categoryIds,
			},
			{
				onSuccess: () => router.replace("/(volunteer)"),
				onError: (error) =>
					Alert.alert(
						"Could not finish setup",
						apiErrorMessage(error, "Please check your details and try again."),
					),
			},
		);
	};

	return (
		<View style={{ flex: 1, backgroundColor: colors.background.warm }}>
			<StepIndicator steps={STEPS} currentStep={step} />

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ padding: spacing[6], paddingTop: spacing[2] }}
				keyboardShouldPersistTaps="handled"
			>
				{step === 0 && (
					<StepAbout
						defaultValues={{
							fullName: draft.fullName || (me?.name ?? ""),
							phone: draft.phone || (me?.phone ?? ""),
						}}
						onSubmit={(data) => {
							merge(data);
							next();
						}}
					/>
				)}
				{step === 1 && (
					<StepLocation
						defaultValues={{ city: draft.city, state: draft.state }}
						onSubmit={(data) => {
							merge(data);
							next();
						}}
					/>
				)}
				{step === 2 && (
					<StepCauses
						defaultValues={{ bio: draft.bio, categoryIds: draft.categoryIds }}
						onSubmit={(data) => {
							merge({
								bio: data.bio ?? "",
								categoryIds: data.categoryIds ?? [],
							});
							next();
						}}
					/>
				)}
				{step === 3 && (
					<StepReview
						draft={draft}
						submitting={complete.isPending}
						onComplete={submit}
					/>
				)}
			</ScrollView>

			{step > 0 && step !== 3 && (
				<View
					style={{ paddingHorizontal: spacing[6], paddingBottom: spacing[8] }}
				>
					<Button variant="ghost" onPress={back}>
						Back
					</Button>
				</View>
			)}
		</View>
	);
}

// ─── Step 1: About you ───────────────────────────────────────────────────────

function StepAbout({
	defaultValues,
	onSubmit,
}: {
	defaultValues: VolunteerProfileStep;
	onSubmit: (data: VolunteerProfileStep) => void;
}) {
	const { colors, spacing } = useTheme();
	const form = useForm<VolunteerProfileStep>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(volunteerProfileStepSchema as any),
		defaultValues,
	});

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>About you</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				NGOs see this when you apply to their events.
			</Body>

			<Label style={{ marginBottom: spacing[1.5] }}>Full name</Label>
			<Input
				placeholder="e.g. Aditi Sharma"
				value={form.watch("fullName")}
				onChangeText={(v) =>
					form.setValue("fullName", v, { shouldValidate: true })
				}
				autoCapitalize="words"
				style={inputStyle}
			/>
			<FieldError message={form.formState.errors.fullName?.message} />

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Phone number
			</Label>
			<Input
				placeholder="e.g. +91 98765 43210"
				value={form.watch("phone")}
				onChangeText={(v) =>
					form.setValue("phone", v, { shouldValidate: true })
				}
				keyboardType="phone-pad"
				style={inputStyle}
			/>
			<FieldError message={form.formState.errors.phone?.message} />

			<View style={{ height: spacing[8] }} />
			<Button onPress={form.handleSubmit(onSubmit)}>Continue</Button>
		</View>
	);
}

// ─── Step 2: Location ────────────────────────────────────────────────────────

function StepLocation({
	defaultValues,
	onSubmit,
}: {
	defaultValues: VolunteerLocationStep;
	onSubmit: (data: VolunteerLocationStep) => void;
}) {
	const { colors, spacing } = useTheme();
	const form = useForm<VolunteerLocationStep>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(volunteerLocationStepSchema as any),
		defaultValues,
	});

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Where are you?</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				We use this to show events and needs near you.
			</Body>

			<View style={{ flexDirection: "row", gap: spacing[3] }}>
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
			<Button onPress={form.handleSubmit(onSubmit)}>Continue</Button>
		</View>
	);
}

// ─── Step 3: Causes ──────────────────────────────────────────────────────────

function StepCauses({
	defaultValues,
	onSubmit,
}: {
	defaultValues: { bio: string; categoryIds: string[] };
	onSubmit: (data: VolunteerInterestsStep) => void;
}) {
	const { colors, spacing } = useTheme();
	const { data: categories, isLoading } = useCategories();
	const [selected, setSelected] = useState<string[]>(defaultValues.categoryIds);
	const form = useForm<VolunteerInterestsStep>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(volunteerInterestsStepSchema as any),
		defaultValues: {
			bio: defaultValues.bio,
			categoryIds: defaultValues.categoryIds,
		},
	});

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	const toggle = (id: string) => {
		const nextSelected = selected.includes(id)
			? selected.filter((c) => c !== id)
			: selected.length >= 5
				? selected
				: [...selected, id];
		setSelected(nextSelected);
		form.setValue("categoryIds", nextSelected, { shouldValidate: true });
	};

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>What do you care about?</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Pick up to 5 causes. You can change these later.
			</Body>

			{isLoading ? (
				<Caption color="tertiary">Loading causes…</Caption>
			) : (
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					{(categories ?? []).map((category) => {
						const active = selected.includes(category.id);
						return (
							<Pressable
								key={category.id}
								onPress={() => toggle(category.id)}
								style={{
									paddingHorizontal: spacing[4],
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
									{category.name}
								</Body>
							</Pressable>
						);
					})}
				</View>
			)}

			<Label style={{ marginTop: spacing[6], marginBottom: spacing[1.5] }}>
				About you <Caption color="tertiary">(optional)</Caption>
			</Label>
			<Input
				placeholder="Skills, availability, anything NGOs should know"
				value={form.watch("bio") ?? ""}
				onChangeText={(v) => form.setValue("bio", v, { shouldValidate: true })}
				multiline
				style={{ ...inputStyle, minHeight: 96, textAlignVertical: "top" }}
			/>
			<FieldError message={form.formState.errors.bio?.message} />

			<View style={{ height: spacing[8] }} />
			<Button onPress={form.handleSubmit(onSubmit)}>Continue</Button>
		</View>
	);
}

// ─── Step 4: Review ──────────────────────────────────────────────────────────

function StepReview({
	draft,
	submitting,
	onComplete,
}: {
	draft: VolunteerDraft;
	submitting: boolean;
	onComplete: () => void;
}) {
	const { colors, spacing } = useTheme();
	const { data: categories } = useCategories();

	const selectedNames = (categories ?? [])
		.filter((c) => draft.categoryIds.includes(c.id))
		.map((c) => c.name)
		.join(", ");

	const rows = [
		{ key: "Name", val: draft.fullName },
		{ key: "Phone", val: draft.phone },
		{ key: "City", val: draft.city },
		{ key: "State", val: draft.state },
		{ key: "Causes", val: selectedNames || "—" },
	];

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Review & finish</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Check your details before we set up your account.
			</Body>

			<View
				style={{
					backgroundColor: colors.background.primary,
					borderRadius: 16,
					borderWidth: 1,
					borderColor: colors.border.light,
					padding: spacing[5],
					marginBottom: spacing[8],
				}}
			>
				{rows.map((row) => (
					<View
						key={row.key}
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							paddingVertical: spacing[1.5],
						}}
					>
						<Caption color="tertiary">{row.key}</Caption>
						<Caption
							weight="medium"
							color={row.val && row.val !== "—" ? "primary" : "tertiary"}
							style={{ flex: 1, textAlign: "right", marginLeft: spacing[4] }}
							numberOfLines={1}
						>
							{row.val || "—"}
						</Caption>
					</View>
				))}
			</View>

			<Body
				color="secondary"
				style={{ textAlign: "center", marginBottom: spacing[4] }}
			>
				You can{" "}
				<Body weight="bold" color="secondary">
					edit everything later
				</Body>{" "}
				from your profile. Upload an ID whenever you're ready to get verified.
			</Body>

			<Button onPress={onComplete} loading={submitting}>
				Complete setup
			</Button>
		</View>
	);
}

// ─── Shared ──────────────────────────────────────────────────────────────────

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
