import type { UpdateOrganizationInput } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { MultiChoiceChips } from "@/components/choice-chips";
import { Field, useFieldInputStyle } from "@/components/form-field";
import {
	Banner,
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	SectionTitle,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption } from "@/components/ui/typography";
import {
	useMyOrganization,
	useUpdateMyOrganization,
} from "@/hooks/use-organization";
import { useCategories } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

interface Form {
	organizationName: string;
	registrationNumber: string;
	phone: string;
	email: string;
	website: string;
	description: string;
	mission: string;
	vision: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	teamSize: string;
	foundingYear: string;
	categoryIds: string[];
}

const EMPTY: Form = {
	organizationName: "",
	registrationNumber: "",
	phone: "",
	email: "",
	website: "",
	description: "",
	mission: "",
	vision: "",
	address: "",
	city: "",
	state: "",
	pincode: "",
	teamSize: "",
	foundingYear: "",
	categoryIds: [],
};

const MAX_CAUSES = 5;

/**
 * The public profile, editable. Grouped the way a reader meets it — who you
 * are, what you work on, how to reach you, where you are — with one primary
 * action pinned in the header so it is never below the fold.
 */
export default function EditOrganization() {
	const { spacing } = useTheme();
	const router = useRouter();
	const inputStyle = useFieldInputStyle();
	const textAreaStyle = useFieldInputStyle(88);
	const addressStyle = useFieldInputStyle(80);

	const org = useMyOrganization();
	const categories = useCategories();
	const update = useUpdateMyOrganization();

	const [form, setForm] = useState<Form>(EMPTY);
	const [error, setError] = useState<string | null>(null);

	// Hydrate once the organization loads. Everything is a string in the form so
	// a cleared field is distinguishable from an untouched one.
	useEffect(() => {
		if (!org.data) return;
		setForm({
			organizationName: org.data.organizationName ?? "",
			registrationNumber: org.data.registrationNumber ?? "",
			phone: org.data.phone ?? "",
			email: org.data.email ?? "",
			website: org.data.website ?? "",
			description: org.data.description ?? "",
			mission: org.data.mission ?? "",
			vision: org.data.vision ?? "",
			address: org.data.address ?? "",
			city: org.data.city ?? "",
			state: org.data.state ?? "",
			pincode: org.data.pincode ?? "",
			teamSize: org.data.teamSize ? String(org.data.teamSize) : "",
			foundingYear: org.data.foundingYear ? String(org.data.foundingYear) : "",
			categoryIds: org.data.categories?.map((c) => c.id) ?? [],
		});
	}, [org.data]);

	const set = <K extends keyof Form>(key: K, value: Form[K]) =>
		setForm((f) => ({ ...f, [key]: value }));

	const toggleCategory = (id: string) => {
		setForm((f) => ({
			...f,
			categoryIds: f.categoryIds.includes(id)
				? f.categoryIds.filter((c) => c !== id)
				: f.categoryIds.length >= MAX_CAUSES
					? f.categoryIds
					: [...f.categoryIds, id],
		}));
	};

	const save = () => {
		// Blank optional fields are sent as undefined so they clear rather than
		// failing a min-length rule.
		const payload: UpdateOrganizationInput = {
			organizationName: form.organizationName.trim() || undefined,
			registrationNumber: form.registrationNumber.trim() || undefined,
			phone: form.phone.trim() || undefined,
			email: form.email.trim() || undefined,
			website: form.website.trim() || undefined,
			description: form.description.trim() || undefined,
			mission: form.mission.trim() || undefined,
			vision: form.vision.trim() || undefined,
			address: form.address.trim() || undefined,
			city: form.city.trim() || undefined,
			state: form.state.trim() || undefined,
			pincode: form.pincode.trim() || undefined,
			teamSize: form.teamSize ? Number(form.teamSize) : undefined,
			foundingYear: form.foundingYear ? Number(form.foundingYear) : undefined,
			categoryIds: form.categoryIds,
		};

		setError(null);
		update.mutate(payload, {
			onSuccess: () => {
				if (router.canGoBack()) router.back();
				else router.replace("/(ngo)/profile");
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	return (
		<Screen>
			<ScreenHeader
				back
				title="Edit profile"
				action={
					<Button
						size="sm"
						onPress={save}
						loading={update.isPending}
						disabled={org.isLoading || org.isError}
					>
						Save
					</Button>
				}
			/>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError ? (
				<ErrorState
					message={apiErrorMessage(org.error)}
					onRetry={() => org.refetch()}
				/>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[12] }}
					keyboardShouldPersistTaps="handled"
					automaticallyAdjustKeyboardInsets
				>
					{error && (
						<View style={{ marginBottom: spacing[5] }}>
							<Banner tone="error" title="Could not save" description={error} />
						</View>
					)}

					<SectionTitle>About</SectionTitle>
					<Field label="Organisation name">
						<Input
							value={form.organizationName}
							onChangeText={(v) => set("organizationName", v)}
							autoCapitalize="words"
							style={inputStyle}
						/>
					</Field>
					<Field
						label="Registration number"
						hint="As printed on your registration certificate. A reviewer checks it against the upload."
					>
						<Input
							value={form.registrationNumber}
							onChangeText={(v) => set("registrationNumber", v)}
							autoCapitalize="characters"
							autoCorrect={false}
							style={inputStyle}
						/>
					</Field>
					<Field
						label="Short description"
						hint="One or two lines. This is the first thing a volunteer reads."
					>
						<Input
							value={form.description}
							onChangeText={(v) => set("description", v)}
							multiline
							placeholder="e.g. We run evening classes for 300 children in Dharavi."
							style={textAreaStyle}
						/>
					</Field>
					<Field label="Mission" optional>
						<Input
							value={form.mission}
							onChangeText={(v) => set("mission", v)}
							multiline
							placeholder="What you set out to change"
							style={textAreaStyle}
						/>
					</Field>
					<Field label="Vision" optional>
						<Input
							value={form.vision}
							onChangeText={(v) => set("vision", v)}
							multiline
							placeholder="What the world looks like when you succeed"
							style={textAreaStyle}
						/>
					</Field>

					<SectionTitle>Causes</SectionTitle>
					<Field
						label="What you work on"
						hint={`Up to ${MAX_CAUSES}. Volunteers filter the feed by these.`}
					>
						{categories.isLoading ? (
							<Caption color="quaternary">Loading causes…</Caption>
						) : (
							<MultiChoiceChips
								label="Causes"
								options={(categories.data ?? []).map((category) => ({
									value: category.id,
									label: category.name,
								}))}
								values={form.categoryIds}
								onToggle={toggleCategory}
								max={MAX_CAUSES}
							/>
						)}
					</Field>

					<SectionTitle>Contact</SectionTitle>
					<Field label="Phone">
						<Input
							value={form.phone}
							onChangeText={(v) => set("phone", v)}
							keyboardType="phone-pad"
							style={inputStyle}
						/>
					</Field>
					<Field label="Email">
						<Input
							value={form.email}
							onChangeText={(v) => set("email", v)}
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
							style={inputStyle}
						/>
					</Field>
					<Field label="Website" optional>
						<Input
							value={form.website}
							onChangeText={(v) => set("website", v)}
							keyboardType="url"
							autoCapitalize="none"
							autoCorrect={false}
							placeholder="https://yourngo.org"
							style={inputStyle}
						/>
					</Field>

					<SectionTitle>Location</SectionTitle>
					<Field label="Address">
						<Input
							value={form.address}
							onChangeText={(v) => set("address", v)}
							multiline
							placeholder="Street, building, landmark"
							style={addressStyle}
						/>
					</Field>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<Field label="City" style={{ flex: 1 }}>
							<Input
								value={form.city}
								onChangeText={(v) => set("city", v)}
								style={inputStyle}
							/>
						</Field>
						<Field label="State" style={{ flex: 1 }}>
							<Input
								value={form.state}
								onChangeText={(v) => set("state", v)}
								style={inputStyle}
							/>
						</Field>
					</View>
					<Field label="Pincode">
						<Input
							value={form.pincode}
							onChangeText={(v) => set("pincode", v.replace(/\D/g, ""))}
							keyboardType="number-pad"
							maxLength={10}
							style={[inputStyle, { maxWidth: 160 }]}
						/>
					</Field>

					<SectionTitle>Organisation</SectionTitle>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<Field label="Team size" optional style={{ flex: 1 }}>
							<Input
								value={form.teamSize}
								onChangeText={(v) => set("teamSize", v.replace(/\D/g, ""))}
								keyboardType="number-pad"
								placeholder="e.g. 25"
								style={inputStyle}
							/>
						</Field>
						<Field label="Founded" optional style={{ flex: 1 }}>
							<Input
								value={form.foundingYear}
								onChangeText={(v) => set("foundingYear", v.replace(/\D/g, ""))}
								keyboardType="number-pad"
								maxLength={4}
								placeholder="e.g. 2015"
								style={inputStyle}
							/>
						</Field>
					</View>

					<Button onPress={save} loading={update.isPending}>
						Save changes
					</Button>
				</ScrollView>
			)}
		</Screen>
	);
}
