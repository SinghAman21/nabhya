import type { UpdateOrganizationInput } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import {
	ErrorState,
	LoadingState,
	ScreenHeader,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, Label } from "@/components/ui/typography";
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

export default function EditOrganization() {
	const { colors, spacing } = useTheme();
	const router = useRouter();

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
				: f.categoryIds.length >= 5
					? f.categoryIds
					: [...f.categoryIds, id],
		}));
	};

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

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
				Alert.alert("Saved", "Your organization profile has been updated.");
				router.back();
			},
			onError: (e) => setError(apiErrorMessage(e)),
		});
	};

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: colors.background.warm,
				paddingHorizontal: spacing[6],
				paddingTop: spacing[8],
			}}
		>
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				style={{ marginBottom: spacing[4] }}
			>
				<ArrowLeft size={22} color={colors.text.secondary as string} />
			</Pressable>

			<ScreenHeader
				title="Edit profile"
				subtitle="This is what volunteers and donors see."
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
				>
					<Field label="Organization name">
						<Input
							value={form.organizationName}
							onChangeText={(v) => set("organizationName", v)}
							style={inputStyle}
						/>
					</Field>

					<Field label="Registration number">
						<Input
							value={form.registrationNumber}
							onChangeText={(v) => set("registrationNumber", v)}
							autoCapitalize="characters"
							style={inputStyle}
						/>
					</Field>

					<Field label="Short description">
						<Input
							value={form.description}
							onChangeText={(v) => set("description", v)}
							multiline
							placeholder="One or two lines about what you do"
							style={{ ...inputStyle, minHeight: 88, textAlignVertical: "top" }}
						/>
					</Field>

					<Field label="Mission">
						<Input
							value={form.mission}
							onChangeText={(v) => set("mission", v)}
							multiline
							style={{ ...inputStyle, minHeight: 88, textAlignVertical: "top" }}
						/>
					</Field>

					<Field label="Vision">
						<Input
							value={form.vision}
							onChangeText={(v) => set("vision", v)}
							multiline
							style={{ ...inputStyle, minHeight: 88, textAlignVertical: "top" }}
						/>
					</Field>

					<Label style={{ marginBottom: spacing[2] }}>
						Causes <Caption color="tertiary">(up to 5)</Caption>
					</Label>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: spacing[2],
							marginBottom: spacing[5],
						}}
					>
						{(categories.data ?? []).map((category) => {
							const active = form.categoryIds.includes(category.id);
							return (
								<Pressable
									key={category.id}
									onPress={() => toggleCategory(category.id)}
									style={{
										paddingHorizontal: spacing[3.5],
										paddingVertical: spacing[2],
										borderRadius: 999,
										backgroundColor: active
											? colors.primary.main
											: colors.background.tertiary,
									}}
								>
									<Caption
										weight={active ? "bold" : "medium"}
										color={
											active ? (colors.primary.contrast as string) : "secondary"
										}
									>
										{category.name}
									</Caption>
								</Pressable>
							);
						})}
					</View>

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
							style={inputStyle}
						/>
					</Field>

					<Field label="Website">
						<Input
							value={form.website}
							onChangeText={(v) => set("website", v)}
							keyboardType="url"
							autoCapitalize="none"
							placeholder="https://yourngo.org"
							style={inputStyle}
						/>
					</Field>

					<Field label="Address">
						<Input
							value={form.address}
							onChangeText={(v) => set("address", v)}
							multiline
							style={{ ...inputStyle, minHeight: 80, textAlignVertical: "top" }}
						/>
					</Field>

					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<View style={{ flex: 1 }}>
							<Field label="City">
								<Input
									value={form.city}
									onChangeText={(v) => set("city", v)}
									style={inputStyle}
								/>
							</Field>
						</View>
						<View style={{ flex: 1 }}>
							<Field label="State">
								<Input
									value={form.state}
									onChangeText={(v) => set("state", v)}
									style={inputStyle}
								/>
							</Field>
						</View>
					</View>

					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<View style={{ flex: 1 }}>
							<Field label="Team size">
								<Input
									value={form.teamSize}
									onChangeText={(v) => set("teamSize", v.replace(/\D/g, ""))}
									keyboardType="number-pad"
									style={inputStyle}
								/>
							</Field>
						</View>
						<View style={{ flex: 1 }}>
							<Field label="Founded">
								<Input
									value={form.foundingYear}
									onChangeText={(v) =>
										set("foundingYear", v.replace(/\D/g, ""))
									}
									keyboardType="number-pad"
									maxLength={4}
									style={inputStyle}
								/>
							</Field>
						</View>
					</View>

					{error && (
						<Caption
							color={colors.error.main as string}
							style={{ marginBottom: spacing[3] }}
						>
							{error}
						</Caption>
					)}

					<Button onPress={save} loading={update.isPending}>
						Save changes
					</Button>
				</ScrollView>
			)}
		</View>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[4] }}>
			<Label style={{ marginBottom: spacing[1.5] }}>{label}</Label>
			{children}
		</View>
	);
}
