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
import { FileText, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChoiceChips } from "@/components/choice-chips";
import { Field, useFieldInputStyle } from "@/components/form-field";
import {
	ListGroup,
	ListRow,
	Screen,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Body, Caption, H2 } from "@/components/ui/typography";
import { useCompleteOrgOnboarding } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { Alert } from "@/lib/alert";
import { apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const STEPS = ["Org", "Address", "Docs", "Team", "Done"];

const ORG_TYPES = [
	{ value: "trust", label: "Trust" },
	{ value: "society", label: "Society" },
	{ value: "section8", label: "Section 8" },
	{ value: "others", label: "Other" },
] as const;

type OrgType = (typeof ORG_TYPES)[number]["value"];

const ORG_TYPE_LABEL: Record<string, string> = Object.fromEntries(
	ORG_TYPES.map((t) => [t.value, t.label]),
);

/**
 * The NGO setup wizard. Five short steps with one primary action each; the
 * step indicator at the top is the only progress UI. Values collect in the
 * persisted auth store between steps and are written to the server once, on
 * the final step, so a closed app resumes where it left off.
 */
export default function OnboardingFlow() {
	const { spacing } = useTheme();
	const insets = useSafeAreaInsets();
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
				orgType: orgProfile.orgType as OrgType,
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
				onSuccess: () => router.replace("/"),
				onError: (error) =>
					Alert.alert(
						"Could not finish setup",
						apiErrorMessage(error, "Please check your details and try again."),
					),
			},
		);
	};

	return (
		// StepIndicator owns its own gutters and top padding, so the screen only
		// supplies the real safe-area inset.
		<Screen style={{ paddingHorizontal: 0, paddingTop: insets.top }}>
			<StepIndicator steps={STEPS} currentStep={step} />

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{
					paddingHorizontal: spacing[5],
					paddingTop: spacing[2],
					paddingBottom: spacing[10] + insets.bottom,
				}}
				keyboardShouldPersistTaps="handled"
				automaticallyAdjustKeyboardInsets
				showsVerticalScrollIndicator={false}
			>
				{step === 0 && (
					<StepBasicInfo
						defaultValues={{
							orgName: orgProfile.orgName,
							phone: orgProfile.phone,
							registrationNumber: orgProfile.registrationNumber,
							orgType: orgProfile.orgType,
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
						onBack={back}
						onSubmit={(data) => {
							mergeProfile(data);
							next();
						}}
					/>
				)}
				{step === 2 && <StepDocuments onBack={back} onContinue={next} />}
				{step === 3 && (
					<StepTeam
						defaultValues={{
							teamSize: orgProfile.teamSize || undefined,
							foundingYear: orgProfile.foundingYear || undefined,
							description: orgProfile.description,
							website: orgProfile.website,
						}}
						onBack={back}
						onSubmit={(data) => {
							mergeProfile(data);
							next();
						}}
					/>
				)}
				{step === 4 && (
					<StepReview
						submitting={completeOnboarding.isPending}
						onBack={back}
						onComplete={submit}
						// Skipping sends them to the public event feed, which needs no
						// role. Routing into (volunteer) would bounce: the role is
						// "organisation", so that layout redirects to "/", which sees no
						// organization and sends them straight back here.
						onSkip={() => router.replace("/events")}
					/>
				)}
			</ScrollView>
		</Screen>
	);
}

/* -------------------------------------------------------------------------- */
/* Shared step furniture                                                      */
/* -------------------------------------------------------------------------- */

function StepHeading({ title, lede }: { title: string; lede: string }) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[6] }}>
			<H2 accessibilityRole="header" style={{ marginBottom: spacing[1] }}>
				{title}
			</H2>
			<Body color="tertiary">{lede}</Body>
		</View>
	);
}

/** Back on the left, the step's one primary action on the right. */
function StepFooter({
	onBack,
	primaryLabel,
	onPrimary,
	loading,
	disabled,
}: {
	onBack?: () => void;
	primaryLabel: string;
	onPrimary: () => void;
	loading?: boolean;
	disabled?: boolean;
}) {
	const { spacing } = useTheme();
	return (
		<View
			style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[4] }}
		>
			{onBack && (
				<Button
					variant="outline"
					onPress={onBack}
					disabled={loading}
					style={{ flexBasis: 108 }}
				>
					Back
				</Button>
			)}
			<Button
				onPress={onPrimary}
				loading={loading}
				disabled={disabled}
				style={{ flex: 1 }}
			>
				{primaryLabel}
			</Button>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 1: the organisation                                                   */
/* -------------------------------------------------------------------------- */

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
	const inputStyle = useFieldInputStyle();
	const form = useForm<Step1BasicInfo>({
		// biome-ignore lint/suspicious/noExplicitAny: @hookform/resolvers v5 Zod v4 incompatibility
		resolver: zodResolver(step1BasicInfoSchema as any),
		defaultValues: {
			orgName: defaultValues.orgName,
			phone: defaultValues.phone,
			registrationNumber: defaultValues.registrationNumber,
			orgType: (defaultValues.orgType ||
				undefined) as Step1BasicInfo["orgType"],
		},
	});
	const errors = form.formState.errors;
	const orgType = form.watch("orgType");

	return (
		<View>
			<StepHeading
				title="Your organisation"
				lede="The name and registration a reviewer will check against your certificate."
			/>

			<Field label="Organisation name" error={errors.orgName?.message}>
				<Input
					placeholder="e.g. Helping Hands Foundation"
					value={form.watch("orgName")}
					onChangeText={(v) =>
						form.setValue("orgName", v, { shouldValidate: true })
					}
					autoCapitalize="words"
					style={inputStyle}
				/>
			</Field>

			<Field label="Registered as" error={errors.orgType?.message}>
				<ChoiceChips
					label="Organisation type"
					options={ORG_TYPES}
					value={orgType}
					onChange={(value) =>
						form.setValue("orgType", value, { shouldValidate: true })
					}
				/>
			</Field>

			<Field
				label="Registration number"
				error={errors.registrationNumber?.message}
				hint="As printed on your registration certificate."
			>
				<Input
					placeholder="e.g. E-12345 (Mumbai)"
					value={form.watch("registrationNumber")}
					onChangeText={(v) =>
						form.setValue("registrationNumber", v, { shouldValidate: true })
					}
					autoCapitalize="characters"
					autoCorrect={false}
					style={inputStyle}
				/>
			</Field>

			<Field
				label="Phone"
				error={errors.phone?.message}
				hint="Where volunteers and the review team can reach you."
			>
				<Input
					placeholder="e.g. +91 98765 43210"
					value={form.watch("phone")}
					onChangeText={(v) =>
						form.setValue("phone", v, { shouldValidate: true })
					}
					keyboardType="phone-pad"
					style={inputStyle}
				/>
			</Field>

			<StepFooter
				primaryLabel="Continue"
				onPrimary={form.handleSubmit(onSubmit)}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 2: address                                                            */
/* -------------------------------------------------------------------------- */

function StepAddress({
	defaultValues,
	onBack,
	onSubmit,
}: {
	defaultValues: {
		address: string;
		city: string;
		state: string;
		pincode: string;
	};
	onBack: () => void;
	onSubmit: (data: Step2Address) => void;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(80);
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
	const errors = form.formState.errors;

	return (
		<View>
			<StepHeading
				title="Where you're based"
				lede="Volunteers see your city first; the full address stays with the review team."
			/>

			<Field label="Full address" error={errors.address?.message}>
				<Input
					placeholder="Street, building, landmark"
					value={form.watch("address")}
					onChangeText={(v) =>
						form.setValue("address", v, { shouldValidate: true })
					}
					multiline
					style={textAreaStyle}
				/>
			</Field>

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
				<Field label="State" error={errors.state?.message} style={{ flex: 1 }}>
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

			<Field label="Pincode" error={errors.pincode?.message}>
				<Input
					placeholder="400001"
					value={form.watch("pincode")}
					onChangeText={(v) =>
						form.setValue("pincode", v.replace(/\D/g, ""), {
							shouldValidate: true,
						})
					}
					keyboardType="number-pad"
					maxLength={10}
					style={[inputStyle, { maxWidth: 160 }]}
				/>
			</Field>

			<StepFooter
				onBack={onBack}
				primaryLabel="Continue"
				onPrimary={form.handleSubmit(onSubmit)}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 3: documents (preview)                                                */
/* -------------------------------------------------------------------------- */

const DOCUMENTS = [
	{
		title: "Registration certificate",
		hint: "Required · Trust deed, society registration or Section 8 certificate",
	},
	{
		title: "PAN card",
		hint: "Required · The organisation's PAN, not a trustee's",
	},
	{
		title: "80G and 12A certificates",
		hint: "Optional · Unlock tax-deductible donations and speed up review",
	},
];

/**
 * Preview of what verification will ask for.
 *
 * Uploads genuinely cannot happen here: documents are stored against the
 * organisation, and the organisation row is only created when this wizard is
 * submitted. The real upload UI is the Verification screen straight afterwards.
 */
function StepDocuments({
	onBack,
	onContinue,
}: {
	onBack: () => void;
	onContinue: () => void;
}) {
	const { colors, spacing } = useTheme();

	return (
		<View>
			<StepHeading
				title="Get ready to verify"
				lede="Nothing to upload yet. Once setup finishes you'll add these from Verification, and a reviewer approves them within a few days."
			/>

			<ListGroup>
				{DOCUMENTS.map((doc) => (
					<ListRow
						key={doc.title}
						icon={FileText}
						label={doc.title}
						hint={doc.hint}
					/>
				))}
			</ListGroup>

			<View
				style={{
					flexDirection: "row",
					gap: spacing[3],
					alignItems: "flex-start",
					marginTop: spacing[5],
				}}
			>
				<ShieldCheck
					size={16}
					color={colors.text.quaternary as string}
					strokeWidth={2}
				/>
				<Caption color="tertiary" style={{ flex: 1 }}>
					Until you're verified, events and needs you create stay private.
					Documents are never shown publicly.
				</Caption>
			</View>

			<StepFooter
				onBack={onBack}
				primaryLabel="Continue"
				onPrimary={onContinue}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 4: team and background                                                */
/* -------------------------------------------------------------------------- */

function StepTeam({
	defaultValues,
	onBack,
	onSubmit,
}: {
	defaultValues: {
		teamSize?: number;
		foundingYear?: number;
		description?: string;
		website?: string;
	};
	onBack: () => void;
	onSubmit: (data: Step4Team) => void;
}) {
	const { spacing } = useTheme();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(96);
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
	const errors = form.formState.errors;
	const teamSize = form.watch("teamSize");
	const foundingYear = form.watch("foundingYear");

	return (
		<View>
			<StepHeading
				title="About your team"
				lede="A little background helps volunteers trust you before they've met you."
			/>

			<View style={{ flexDirection: "row", gap: spacing[3] }}>
				<Field
					label="Team size"
					error={errors.teamSize?.message}
					style={{ flex: 1 }}
				>
					<Input
						placeholder="e.g. 25"
						value={teamSize ? String(teamSize) : ""}
						onChangeText={(v) =>
							form.setValue(
								"teamSize",
								v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : 0,
								{ shouldValidate: true },
							)
						}
						keyboardType="number-pad"
						style={inputStyle}
					/>
				</Field>
				<Field
					label="Founded in"
					error={errors.foundingYear?.message}
					style={{ flex: 1 }}
				>
					<Input
						placeholder="e.g. 2015"
						value={foundingYear ? String(foundingYear) : ""}
						onChangeText={(v) =>
							form.setValue(
								"foundingYear",
								v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : 0,
								{ shouldValidate: true },
							)
						}
						keyboardType="number-pad"
						maxLength={4}
						style={inputStyle}
					/>
				</Field>
			</View>

			<Field
				label="What you do"
				optional
				error={errors.description?.message}
				hint="One or two lines. You can write more later."
			>
				<Input
					placeholder="e.g. We run evening classes for 300 children in Dharavi."
					value={form.watch("description")}
					onChangeText={(v) =>
						form.setValue("description", v, { shouldValidate: true })
					}
					multiline
					style={textAreaStyle}
				/>
			</Field>

			<Field label="Website" optional error={errors.website?.message}>
				<Input
					placeholder="https://yourngo.org"
					value={form.watch("website")}
					onChangeText={(v) =>
						form.setValue("website", v, { shouldValidate: true })
					}
					autoCapitalize="none"
					autoCorrect={false}
					keyboardType="url"
					style={inputStyle}
				/>
			</Field>

			<StepFooter
				onBack={onBack}
				primaryLabel="Continue"
				onPrimary={form.handleSubmit(onSubmit)}
			/>
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Step 5: review                                                             */
/* -------------------------------------------------------------------------- */

function StepReview({
	onBack,
	onComplete,
	onSkip,
	submitting,
}: {
	onBack: () => void;
	onComplete: () => void;
	onSkip: () => void;
	submitting: boolean;
}) {
	const { colors, spacing } = useTheme();
	const profile = useAuthStore((s) => s.orgProfile);

	const sections = [
		{
			label: "Organisation",
			rows: [
				{ key: "Name", val: profile.orgName },
				{
					key: "Type",
					val: ORG_TYPE_LABEL[profile.orgType] ?? profile.orgType,
				},
				{ key: "Registration no.", val: profile.registrationNumber },
				{ key: "Phone", val: profile.phone },
			],
		},
		{
			label: "Address",
			rows: [
				{ key: "Address", val: profile.address },
				{
					key: "City",
					val: [profile.city, profile.state].filter(Boolean).join(", "),
				},
				{ key: "Pincode", val: profile.pincode },
			],
		},
		{
			label: "Team",
			rows: [
				{ key: "Size", val: profile.teamSize ? String(profile.teamSize) : "" },
				{
					key: "Founded",
					val: profile.foundingYear ? String(profile.foundingYear) : "",
				},
				{ key: "Website", val: profile.website },
			],
		},
	];

	return (
		<View>
			<StepHeading
				title="Check and finish"
				lede="This creates your organisation. Everything here can be edited later from Profile."
			/>

			{sections.map((section) => (
				<View key={section.label} style={{ marginBottom: spacing[5] }}>
					<SectionTitle>{section.label}</SectionTitle>
					<Surface>
						{section.rows.map((row, index) => (
							<View
								key={row.key}
								style={{
									flexDirection: "row",
									justifyContent: "space-between",
									gap: spacing[4],
									paddingVertical: spacing[2],
									borderTopWidth: index === 0 ? 0 : 1,
									borderTopColor: colors.border.hairline,
								}}
							>
								<Caption color="tertiary">{row.key}</Caption>
								<Caption
									weight="medium"
									color={row.val ? "primary" : "quaternary"}
									style={{ flex: 1, textAlign: "right" }}
									numberOfLines={2}
								>
									{row.val || "Not given"}
								</Caption>
							</View>
						))}
					</Surface>
				</View>
			))}

			<StepFooter
				onBack={onBack}
				primaryLabel="Create organisation"
				onPrimary={onComplete}
				loading={submitting}
			/>

			<Button
				variant="ghost"
				onPress={onSkip}
				disabled={submitting}
				style={{ marginTop: spacing[2] }}
			>
				Not now — browse events first
			</Button>
		</View>
	);
}
