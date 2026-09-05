import { zodResolver } from "@hookform/resolvers/zod";
import {
	type Step1BasicInfo,
	type Step2Address,
	type Step4Team,
	step1BasicInfoSchema,
	step2AddressSchema,
	step4TeamSchema,
} from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2, Label } from "@/components/ui/typography";
import { useCompleteOrgOnboarding } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const STEPS = ["Org", "Address", "Docs", "Team", "Done"];

const ORG_TYPES = [
	{ value: "trust", label: "Trust" },
	{ value: "society", label: "Society" },
	{ value: "section8", label: "Section 8" },
	{ value: "others", label: "Others" },
] as const;

export default function OnboardingFlow() {
	const { colors, spacing } = useTheme();
	const [step, setStep] = useState(0);
	const router = useRouter();
	const mergeProfile = useAuthStore((s) => s.mergeProfile);
	const orgProfile = useAuthStore((s) => s.orgProfile);
	const completeOnboarding = useCompleteOrgOnboarding();

	const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
	const back = () => setStep((s) => Math.max(s - 1, 0));

	/**
	 * The wizard collects into the local store step by step; this is the single
	 * write to the server. Zeroed numeric fields mean "not provided" — the API
	 * schema treats them as optional but rejects 0.
	 */
	const submit = () => {
		completeOnboarding.mutate(
			{
				orgName: orgProfile.orgName,
				phone: orgProfile.phone,
				orgType: orgProfile.orgType as
					| "trust"
					| "society"
					| "section8"
					| "others",
				registrationNumber: orgProfile.registrationNumber,
				address: orgProfile.address,
				city: orgProfile.city,
				state: orgProfile.state,
				pincode: orgProfile.pincode,
				teamSize: orgProfile.teamSize || undefined,
				foundingYear: orgProfile.foundingYear || undefined,
				description: orgProfile.description || undefined,
				website: orgProfile.website || undefined,
			},
			{
				onSuccess: () => router.replace("/success"),
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
					<StepBasicInfo
						defaultValues={{
							orgName: orgProfile.orgName,
							phone: orgProfile.phone,
							registrationNumber: orgProfile.registrationNumber,
							orgType:
								(orgProfile.orgType as Step1BasicInfo["orgType"] | "") ||
								("" as never),
						}}
						onSubmit={(data) => {
							mergeProfile(data);
							next();
						}}
					/>
				)}
				{step === 1 && (
					<StepAddress
						defaultValues={{
							address: orgProfile.address,
							city: orgProfile.city,
							state: orgProfile.state,
							pincode: orgProfile.pincode,
						}}
						onSubmit={(data) => {
							mergeProfile(data);
							next();
						}}
					/>
				)}
				{step === 2 && <StepDocuments />}
				{step === 3 && (
					<StepTeam
						defaultValues={{
							teamSize: orgProfile.teamSize || undefined,
							foundingYear: orgProfile.foundingYear || undefined,
							description: orgProfile.description,
							website: orgProfile.website,
						}}
						onSubmit={(data) => {
							mergeProfile(data);
							next();
						}}
					/>
				)}
				{step === 4 && (
					<StepReview
						submitting={completeOnboarding.isPending}
						onComplete={submit}
						// Skipping sends them to the public event feed, which needs no
						// role. Routing into (volunteer) would bounce: the role is
						// "organisation", so that layout redirects to "/", which sees no
						// organization and sends them straight back here.
						onSkip={() => router.replace("/events")}
					/>
				)}
			</ScrollView>

			{step > 0 && step !== 2 && step !== 4 && (
				<View
					style={{
						paddingHorizontal: spacing[6],
						paddingBottom: spacing[8],
					}}
				>
					<Button variant="ghost" onPress={back}>
						Back
					</Button>
				</View>
			)}

			{step === 2 && (
				<View
					style={{
						paddingHorizontal: spacing[6],
						paddingBottom: spacing[8],
					}}
				>
					<Body
						color="secondary"
						style={{ textAlign: "center", marginBottom: spacing[4] }}
					>
						You'll upload these from your profile after setup.
					</Body>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<View style={{ flex: 1 }}>
							<Button variant="ghost" onPress={back}>
								Back
							</Button>
						</View>
						<View style={{ flex: 1 }}>
							<Button onPress={next}>Continue</Button>
						</View>
					</View>
				</View>
			)}
		</View>
	);
}

// ─── Step 1: Basic Info ──────────────────────────────────────────────

function StepBasicInfo({
	defaultValues,
	onSubmit,
}: {
	defaultValues: {
		orgName: string;
		phone: string;
		orgType: string;
		registrationNumber: string;
	};
	onSubmit: (data: Step1BasicInfo) => void;
}) {
	const { colors, spacing } = useTheme();
	const form = useForm<Step1BasicInfo>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(step1BasicInfoSchema as any),
		defaultValues: {
			orgName: defaultValues.orgName,
			phone: defaultValues.phone,
			registrationNumber: defaultValues.registrationNumber,
			orgType: defaultValues.orgType as Step1BasicInfo["orgType"],
		},
	});
	const [selType, setSelType] = useState<string>(defaultValues.orgType || "");

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Organization info</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Tell us about your NGO.
			</Body>

			<Label style={{ marginBottom: spacing[1.5] }}>Organization name</Label>
			<Input
				placeholder="e.g. Helping Hands Foundation"
				value={form.watch("orgName")}
				onChangeText={(v) =>
					form.setValue("orgName", v, { shouldValidate: true })
				}
				autoCapitalize="words"
				style={inputStyle}
			/>
			{form.formState.errors.orgName?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.orgName.message}
				</Caption>
			)}

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
			{form.formState.errors.phone?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.phone.message}
				</Caption>
			)}

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Registration number
			</Label>
			<Input
				placeholder="As printed on your registration certificate"
				value={form.watch("registrationNumber")}
				onChangeText={(v) =>
					form.setValue("registrationNumber", v, { shouldValidate: true })
				}
				autoCapitalize="characters"
				style={inputStyle}
			/>
			{form.formState.errors.registrationNumber?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.registrationNumber.message}
				</Caption>
			)}

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[2] }}>
				Organization type
			</Label>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
				{ORG_TYPES.map((t) => {
					const active = selType === t.value;
					return (
						<Pressable
							key={t.value}
							onPress={() => {
								setSelType(t.value);
								form.setValue("orgType", t.value, { shouldValidate: true });
							}}
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
								{t.label}
							</Body>
						</Pressable>
					);
				})}
			</View>
			{form.formState.errors.orgType?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.orgType.message}
				</Caption>
			)}

			<View style={{ height: spacing[8] }} />

			<Button onPress={form.handleSubmit(onSubmit)}>Continue</Button>
		</View>
	);
}

// ─── Step 2: Address ─────────────────────────────────────────────────

function StepAddress({
	defaultValues,
	onSubmit,
}: {
	defaultValues: {
		address: string;
		city: string;
		state: string;
		pincode: string;
	};
	onSubmit: (data: Step2Address) => void;
}) {
	const { colors, spacing } = useTheme();
	const form = useForm<Step2Address>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(step2AddressSchema as any),
		defaultValues: {
			address: defaultValues.address,
			city: defaultValues.city,
			state: defaultValues.state,
			pincode: defaultValues.pincode,
		},
	});

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Address & location</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Where is your organization based?
			</Body>

			<Label style={{ marginBottom: spacing[1.5] }}>Full address</Label>
			<Input
				placeholder="Street, building, landmark"
				value={form.watch("address")}
				onChangeText={(v) =>
					form.setValue("address", v, { shouldValidate: true })
				}
				multiline
				style={{ ...inputStyle, minHeight: 80, textAlignVertical: "top" }}
			/>
			{form.formState.errors.address?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.address.message}
				</Caption>
			)}

			<View
				style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[5] }}
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
					{form.formState.errors.city?.message && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[1] }}
						>
							{form.formState.errors.city.message}
						</Caption>
					)}
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
					{form.formState.errors.state?.message && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[1] }}
						>
							{form.formState.errors.state.message}
						</Caption>
					)}
				</View>
			</View>

			<View style={{ marginTop: spacing[5] }}>
				<Label style={{ marginBottom: spacing[1.5] }}>Pincode</Label>
				<Input
					placeholder="400001"
					value={form.watch("pincode")}
					onChangeText={(v) =>
						form.setValue("pincode", v, { shouldValidate: true })
					}
					keyboardType="number-pad"
					style={[inputStyle, { maxWidth: 160 }]}
				/>
				{form.formState.errors.pincode?.message && (
					<Caption
						color={colors.error.main as string}
						style={{ marginTop: spacing[1] }}
					>
						{form.formState.errors.pincode.message}
					</Caption>
				)}
			</View>

			<View style={{ height: spacing[8] }} />

			<Button onPress={form.handleSubmit(onSubmit)}>Continue</Button>
		</View>
	);
}

// ─── Step 3: Documents ───────────────────────────────────────────────

const DOCUMENTS = [
	{
		title: "Registration certificate",
		hint: "Trust / Society / Section 8 registration document",
	},
	{
		title: "PAN card",
		hint: "Organization PAN card for financial verification",
	},
	{
		title: "80G / 12A certificate",
		hint: "If you have them — they unlock tax-deductible donations",
	},
];

/**
 * Preview of what verification will ask for.
 *
 * Uploads genuinely cannot happen here: documents are stored against the
 * organization, and the organization row is only created when this wizard is
 * submitted. The real upload UI lives on the Profile tab straight afterwards.
 */
function StepDocuments() {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Verification documents</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[6] }}>
				Here's what we'll ask for. You'll upload these from your profile once
				setup is finished.
			</Body>

			{DOCUMENTS.map((doc) => (
				<View
					key={doc.title}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[3],
						borderWidth: 1,
						borderColor: colors.border.light,
						backgroundColor: colors.background.primary,
						borderRadius: borderRadius.lg,
						padding: spacing[4],
						marginBottom: spacing[3],
					}}
				>
					<View
						style={{
							width: 8,
							height: 8,
							borderRadius: 4,
							backgroundColor: colors.border.dark,
						}}
					/>
					<View style={{ flex: 1 }}>
						<Body weight="medium">{doc.title}</Body>
						<Caption color="tertiary">{doc.hint}</Caption>
					</View>
				</View>
			))}
		</View>
	);
}

// ─── Step 4: Team & Description ──────────────────────────────────────

function StepTeam({
	defaultValues,
	onSubmit,
}: {
	defaultValues: {
		teamSize?: number;
		foundingYear?: number;
		description?: string;
		website?: string;
	};
	onSubmit: (data: Step4Team) => void;
}) {
	const { colors, spacing } = useTheme();
	const form = useForm<Step4Team>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(step4TeamSchema as any),
		defaultValues: {
			teamSize: defaultValues.teamSize ?? 0,
			foundingYear: defaultValues.foundingYear ?? 0,
			description: defaultValues.description ?? "",
			website: defaultValues.website ?? "",
		},
	});

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Team & background</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Help others understand your organization better.
			</Body>

			<View style={{ flexDirection: "row", gap: spacing[3] }}>
				<View style={{ flex: 1 }}>
					<Label style={{ marginBottom: spacing[1.5] }}>Team size</Label>
					<Input
						placeholder="e.g. 25"
						value={form.watch("teamSize") ? String(form.watch("teamSize")) : ""}
						onChangeText={(v) =>
							form.setValue("teamSize", v ? Number(v) : 0, {
								shouldValidate: true,
							})
						}
						keyboardType="number-pad"
						style={inputStyle}
					/>
					{form.formState.errors.teamSize?.message && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[1] }}
						>
							{form.formState.errors.teamSize.message}
						</Caption>
					)}
				</View>
				<View style={{ flex: 1 }}>
					<Label style={{ marginBottom: spacing[1.5] }}>Founding year</Label>
					<Input
						placeholder="e.g. 2015"
						value={
							form.watch("foundingYear")
								? String(form.watch("foundingYear"))
								: ""
						}
						onChangeText={(v) =>
							form.setValue("foundingYear", v ? Number(v) : 0, {
								shouldValidate: true,
							})
						}
						keyboardType="number-pad"
						style={inputStyle}
					/>
					{form.formState.errors.foundingYear?.message && (
						<Caption
							color={colors.error.main as string}
							style={{ marginTop: spacing[1] }}
						>
							{form.formState.errors.foundingYear.message}
						</Caption>
					)}
				</View>
			</View>

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Description <Caption color="tertiary">(optional)</Caption>
			</Label>
			<Input
				placeholder="Tell us about your mission and impact"
				value={form.watch("description")}
				onChangeText={(v) =>
					form.setValue("description", v, { shouldValidate: true })
				}
				multiline
				style={{ ...inputStyle, minHeight: 96, textAlignVertical: "top" }}
			/>
			{form.formState.errors.description?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.description.message}
				</Caption>
			)}

			<Label style={{ marginTop: spacing[5], marginBottom: spacing[1.5] }}>
				Website <Caption color="tertiary">(optional)</Caption>
			</Label>
			<Input
				placeholder="https://yourngo.org"
				value={form.watch("website")}
				onChangeText={(v) =>
					form.setValue("website", v, { shouldValidate: true })
				}
				autoCapitalize="none"
				keyboardType="url"
				style={inputStyle}
			/>
			{form.formState.errors.website?.message && (
				<Caption
					color={colors.error.main as string}
					style={{ marginTop: spacing[1] }}
				>
					{form.formState.errors.website.message}
				</Caption>
			)}

			<View style={{ height: spacing[8] }} />

			<Button onPress={form.handleSubmit(onSubmit)}>Continue</Button>
		</View>
	);
}

// ─── Step 5: Review ──────────────────────────────────────────────────

function StepReview({
	onComplete,
	onSkip,
	submitting,
}: {
	onComplete: () => void;
	onSkip: () => void;
	submitting: boolean;
}) {
	const { colors, spacing } = useTheme();
	const profile = useAuthStore((s) => s.orgProfile);

	const sections = [
		{
			label: "Organization",
			rows: [
				{ key: "Name", val: profile.orgName },
				{ key: "Phone", val: profile.phone },
				{ key: "Type", val: profile.orgType },
				{ key: "Registration no.", val: profile.registrationNumber },
			],
		},
		{
			label: "Address",
			rows: [
				{ key: "Address", val: profile.address },
				{ key: "City", val: profile.city },
				{ key: "State", val: profile.state },
				{ key: "Pincode", val: profile.pincode },
			],
		},
		{
			label: "Team",
			rows: [
				{ key: "Size", val: profile.teamSize ? String(profile.teamSize) : "—" },
				{
					key: "Founded",
					val: profile.foundingYear ? String(profile.foundingYear) : "—",
				},
				{ key: "Website", val: profile.website || "—" },
			],
		},
	];

	return (
		<View>
			<H2 style={{ marginBottom: spacing[1] }}>Review & finish</H2>
			<Body color="tertiary" style={{ marginBottom: spacing[8] }}>
				Review your details before we set up your account.
			</Body>

			<View
				style={{
					backgroundColor: colors.background.primary,
					borderRadius: 16,
					borderWidth: 1,
					borderColor: colors.border.light,
					overflow: "hidden",
					marginBottom: spacing[8],
				}}
			>
				{sections.map((section, si) => (
					<View key={section.label}>
						{si > 0 && (
							<View
								style={{
									height: 1,
									backgroundColor: colors.border.light,
									marginHorizontal: spacing[5],
								}}
							/>
						)}
						<View style={{ padding: spacing[5] }}>
							<Body
								weight="bold"
								color="secondary"
								style={{
									fontSize: 11,
									letterSpacing: 1,
									textTransform: "uppercase",
									marginBottom: spacing[3],
								}}
							>
								{section.label}
							</Body>
							{section.rows.map((row) => (
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
										style={{
											flex: 1,
											textAlign: "right",
											marginLeft: spacing[4],
										}}
										numberOfLines={1}
									>
										{row.val || "—"}
									</Caption>
								</View>
							))}
						</View>
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
				from settings. Documents can be uploaded after verification.
			</Body>

			<Button
				onPress={onComplete}
				loading={submitting}
				style={{ marginBottom: spacing[3] }}
			>
				Complete setup
			</Button>

			<Button variant="ghost" onPress={onSkip} disabled={submitting}>
				Skip verification — browse first
			</Button>
		</View>
	);
}
