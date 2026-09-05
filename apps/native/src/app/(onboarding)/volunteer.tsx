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
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	ListGroup,
	ListRow,
	LoadingState,
	Screen,
} from "@/components/screen-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import {
	useCategories,
	useCompleteVolunteerOnboarding,
	useMe,
} from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { focusable } from "@/lib/focus";

const STEPS = ["You", "Location", "Causes", "Done"];
const MAX_CAUSES = 5;

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
 * per-step validation, one submit at the end. Back lives in the header beside
 * the steps; each step ends in one full-width Continue.
 */
export default function VolunteerOnboarding() {
	const { spacing } = useTheme();
	const { isDesktop } = useMedia();
	const insets = useSafeAreaInsets();
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
						"Couldn't finish setup",
						apiErrorMessage(error, "Check your details and try again."),
					),
			},
		);
	};

	return (
		<Screen style={{ paddingTop: 0, paddingHorizontal: 0 }}>
			<View
				style={
					isDesktop
						? { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }
						: { flex: 1 }
				}
			>
				<StepIndicator
					steps={STEPS}
					currentStep={step}
					{...(step > 0 ? { onBack: back } : {})}
				/>

				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<ScrollView
						style={{ flex: 1 }}
						contentContainerStyle={{
							paddingHorizontal: spacing[5],
							paddingTop: spacing[2],
							paddingBottom: insets.bottom + spacing[8],
						}}
						keyboardShouldPersistTaps="handled"
						automaticallyAdjustKeyboardInsets
						showsVerticalScrollIndicator={false}
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
								defaultValues={{
									bio: draft.bio,
									categoryIds: draft.categoryIds,
								}}
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
								onEdit={setStep}
							/>
						)}
					</ScrollView>
				</KeyboardAvoidingView>
			</View>
		</Screen>
	);
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function StepHeading({ title, lede }: { title: string; lede: string }) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[6] }}>
			<H2 accessibilityRole="header">{title}</H2>
			<Body color="tertiary" style={{ marginTop: spacing[1] }}>
				{lede}
			</Body>
		</View>
	);
}

function Field({
	label,
	optional,
	error,
	children,
}: {
	label: string;
	optional?: boolean;
	error?: string;
	children: React.ReactNode;
}) {
	const { colors, spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[4] }}>
			<Label style={{ marginBottom: spacing[1.5] }}>
				{label}
				{optional && <Caption color="tertiary"> (optional)</Caption>}
			</Label>
			{children}
			{error && (
				<Caption color={colors.error.ink} style={{ marginTop: spacing[1] }}>
					{error}
				</Caption>
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
	const { spacing } = useTheme();
	const form = useForm<VolunteerProfileStep>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(volunteerProfileStepSchema as any),
		defaultValues,
	});

	return (
		<View>
			<StepHeading
				title="About you"
				lede="NGOs see this when you apply to their events."
			/>

			<Field label="Full name" error={form.formState.errors.fullName?.message}>
				<Input
					placeholder="e.g. Aditi Sharma"
					value={form.watch("fullName")}
					onChangeText={(v) =>
						form.setValue("fullName", v, { shouldValidate: true })
					}
					autoCapitalize="words"
					autoComplete="name"
					textContentType="name"
					returnKeyType="next"
					accessibilityLabel="Full name"
				/>
			</Field>

			<Field label="Phone number" error={form.formState.errors.phone?.message}>
				<Input
					placeholder="e.g. +91 98765 43210"
					value={form.watch("phone")}
					onChangeText={(v) =>
						form.setValue("phone", v, { shouldValidate: true })
					}
					keyboardType="phone-pad"
					autoComplete="tel"
					textContentType="telephoneNumber"
					returnKeyType="done"
					accessibilityLabel="Phone number"
				/>
			</Field>

			<Button
				onPress={form.handleSubmit(onSubmit)}
				size="lg"
				style={{ marginTop: spacing[4] }}
			>
				Continue
			</Button>
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
	const { spacing } = useTheme();
	const form = useForm<VolunteerLocationStep>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(volunteerLocationStepSchema as any),
		defaultValues,
	});

	return (
		<View>
			<StepHeading
				title="Where are you?"
				lede="So we can show events and needs near you first."
			/>

			<View style={{ flexDirection: "row", gap: spacing[3] }}>
				<View style={{ flex: 1 }}>
					<Field label="City" error={form.formState.errors.city?.message}>
						<Input
							placeholder="Mumbai"
							value={form.watch("city")}
							onChangeText={(v) =>
								form.setValue("city", v, { shouldValidate: true })
							}
							autoCapitalize="words"
							returnKeyType="next"
							accessibilityLabel="City"
						/>
					</Field>
				</View>
				<View style={{ flex: 1 }}>
					<Field label="State" error={form.formState.errors.state?.message}>
						<Input
							placeholder="Maharashtra"
							value={form.watch("state")}
							onChangeText={(v) =>
								form.setValue("state", v, { shouldValidate: true })
							}
							autoCapitalize="words"
							returnKeyType="done"
							accessibilityLabel="State"
						/>
					</Field>
				</View>
			</View>

			<Button
				onPress={form.handleSubmit(onSubmit)}
				size="lg"
				style={{ marginTop: spacing[4] }}
			>
				Continue
			</Button>
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

	const atLimit = selected.length >= MAX_CAUSES;

	const toggle = (id: string) => {
		const nextSelected = selected.includes(id)
			? selected.filter((c) => c !== id)
			: atLimit
				? selected
				: [...selected, id];
		setSelected(nextSelected);
		form.setValue("categoryIds", nextSelected, { shouldValidate: true });
	};

	return (
		<View>
			<StepHeading
				title="What do you care about?"
				lede={`Pick up to ${MAX_CAUSES} causes. You can change these later.`}
			/>

			{isLoading ? (
				<LoadingState label="Loading causes" />
			) : (
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					{(categories ?? []).map((category) => {
						const active = selected.includes(category.id);
						const blocked = !active && atLimit;
						return (
							<Pressable
								key={category.id}
								onPress={() => toggle(category.id)}
								disabled={blocked}
								hitSlop={4}
								accessibilityRole="checkbox"
								accessibilityLabel={category.name}
								accessibilityState={{ checked: active, disabled: blocked }}
								{...focusable}
								style={({ pressed }) => ({
									minHeight: 40,
									justifyContent: "center",
									paddingHorizontal: spacing[4],
									borderRadius: 999,
									backgroundColor: active
										? (colors.text.primary as string)
										: pressed
											? colors.background.subtle
											: "transparent",
									borderWidth: active ? 0 : 1,
									borderColor: colors.border.medium,
									opacity: blocked ? 0.45 : 1,
								})}
							>
								<Label
									weight={active ? "semibold" : "normal"}
									color={active ? (colors.text.inverse as string) : "secondary"}
								>
									{category.name}
								</Label>
							</Pressable>
						);
					})}
				</View>
			)}
			<Caption color="quaternary" style={{ marginTop: spacing[2] }}>
				{selected.length === 0
					? "Pick at least one to get a feed that fits you."
					: `${selected.length} of ${MAX_CAUSES} chosen`}
			</Caption>
			{form.formState.errors.categoryIds?.message && (
				<Caption color={colors.error.ink} style={{ marginTop: spacing[1] }}>
					{form.formState.errors.categoryIds.message}
				</Caption>
			)}

			<View style={{ marginTop: spacing[6] }}>
				<Field
					label="About you"
					optional
					error={form.formState.errors.bio?.message}
				>
					<Input
						placeholder="Skills, availability, anything NGOs should know"
						value={form.watch("bio") ?? ""}
						onChangeText={(v) =>
							form.setValue("bio", v, { shouldValidate: true })
						}
						multiline
						accessibilityLabel="About you"
						style={{ minHeight: 96, textAlignVertical: "top" }}
					/>
				</Field>
			</View>

			<Button
				onPress={form.handleSubmit(onSubmit)}
				size="lg"
				style={{ marginTop: spacing[2] }}
			>
				Continue
			</Button>
		</View>
	);
}

// ─── Step 4: Review ──────────────────────────────────────────────────────────

function StepReview({
	draft,
	submitting,
	onComplete,
	onEdit,
}: {
	draft: VolunteerDraft;
	submitting: boolean;
	onComplete: () => void;
	onEdit: (step: number) => void;
}) {
	const { spacing } = useTheme();
	const { data: categories } = useCategories();

	const selectedNames = (categories ?? [])
		.filter((c) => draft.categoryIds.includes(c.id))
		.map((c) => c.name)
		.join(", ");

	const rows: Array<{ label: string; value: string; step: number }> = [
		{ label: "Name", value: draft.fullName, step: 0 },
		{ label: "Phone", value: draft.phone, step: 0 },
		{
			label: "Location",
			value: [draft.city, draft.state].filter(Boolean).join(", "),
			step: 1,
		},
		{ label: "Causes", value: selectedNames, step: 2 },
	];

	return (
		<View>
			<StepHeading title="Check and finish" lede="Tap any line to change it." />

			<ListGroup>
				{rows.map((row) => (
					<ListRow
						key={row.label}
						label={row.label}
						hint={row.value || "Not set"}
						onPress={() => onEdit(row.step)}
					/>
				))}
			</ListGroup>

			<Caption
				color="tertiary"
				style={{ textAlign: "center", marginTop: spacing[5] }}
			>
				You can edit all of this later from your profile, and verify your
				identity whenever you're ready.
			</Caption>

			<Button
				onPress={onComplete}
				loading={submitting}
				size="lg"
				style={{ marginTop: spacing[5] }}
			>
				Finish setup
			</Button>
		</View>
	);
}
