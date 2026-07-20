import { updateOrganizationSchema } from "@nabhya/shared";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption, H2, Label } from "@/components/ui/typography";
import { useUpdateOrganization } from "@/hooks/use-organizations";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import type { OrganizationDetail } from "@/lib/types";

interface Draft {
	organizationName: string;
	email: string;
	phone: string;
	website: string;
	description: string;
	mission: string;
	address: string;
	city: string;
	state: string;
	pincode: string;
	teamSize: string;
	foundingYear: string;
}

/**
 * Edit-organization sheet. Assembles the payload and validates it against the
 * shared schema in one pass, mirroring EventFormSheet.
 */
export function OrgEditSheet({
	visible,
	onClose,
	organization,
}: {
	visible: boolean;
	onClose: () => void;
	organization: OrganizationDetail | undefined;
}) {
	const { colors, spacing } = useTheme();
	const updateOrganization = useUpdateOrganization();

	const [draft, setDraft] = useState<Draft>(seed(organization));
	const [errors, setErrors] = useState<Record<string, string>>({});

	// biome-ignore lint/correctness/useExhaustiveDependencies: seed only on open
	useEffect(() => {
		if (!visible) return;
		setDraft(seed(organization));
		setErrors({});
	}, [visible, organization?.id]);

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	const inputStyle = {
		borderWidth: 0,
		borderRadius: 12,
		backgroundColor: colors.background.tertiary,
		paddingVertical: spacing[3.5],
	} as const;

	const submit = () => {
		const candidate = {
			organizationName: draft.organizationName,
			email: draft.email || undefined,
			phone: draft.phone || undefined,
			website: draft.website,
			description: draft.description,
			mission: draft.mission,
			address: draft.address,
			city: draft.city || undefined,
			state: draft.state || undefined,
			pincode: draft.pincode || undefined,
			teamSize: draft.teamSize || undefined,
			foundingYear: draft.foundingYear || undefined,
		};

		const parsed = updateOrganizationSchema.safeParse(candidate);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? "form");
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			setErrors(fieldErrors);
			return;
		}

		setErrors({});
		updateOrganization.mutate(parsed.data, {
			onSuccess: onClose,
			onError: (error) =>
				Alert.alert("Could not save changes", apiErrorMessage(error)),
		});
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
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
					<H2>Edit organization</H2>
					<Pressable onPress={onClose} hitSlop={12}>
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
					<Field label="Organization name">
						<Input
							value={draft.organizationName}
							onChangeText={(v) => set("organizationName", v)}
							style={inputStyle}
						/>
						<FieldError message={errors.organizationName} />
					</Field>

					<Field label="About the organization">
						<Input
							placeholder="What you do and who you serve"
							value={draft.description}
							onChangeText={(v) => set("description", v)}
							multiline
							style={{
								...inputStyle,
								minHeight: 100,
								textAlignVertical: "top",
							}}
						/>
						<FieldError message={errors.description} />
					</Field>

					<Field label="Mission" optional>
						<Input
							value={draft.mission}
							onChangeText={(v) => set("mission", v)}
							multiline
							style={{ ...inputStyle, minHeight: 80, textAlignVertical: "top" }}
						/>
						<FieldError message={errors.mission} />
					</Field>

					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<View style={{ flex: 1 }}>
							<Field label="Contact email">
								<Input
									value={draft.email}
									onChangeText={(v) => set("email", v)}
									autoCapitalize="none"
									keyboardType="email-address"
									style={inputStyle}
								/>
								<FieldError message={errors.email} />
							</Field>
						</View>
						<View style={{ flex: 1 }}>
							<Field label="Phone">
								<Input
									value={draft.phone}
									onChangeText={(v) => set("phone", v)}
									keyboardType="phone-pad"
									style={inputStyle}
								/>
								<FieldError message={errors.phone} />
							</Field>
						</View>
					</View>

					<Field label="Website" optional>
						<Input
							placeholder="https://…"
							value={draft.website}
							onChangeText={(v) => set("website", v)}
							autoCapitalize="none"
							keyboardType="url"
							style={inputStyle}
						/>
						<FieldError message={errors.website} />
					</Field>

					<Field label="Address" optional>
						<Input
							value={draft.address}
							onChangeText={(v) => set("address", v)}
							style={inputStyle}
						/>
						<FieldError message={errors.address} />
					</Field>

					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<View style={{ flex: 1 }}>
							<Field label="City">
								<Input
									value={draft.city}
									onChangeText={(v) => set("city", v)}
									style={inputStyle}
								/>
								<FieldError message={errors.city} />
							</Field>
						</View>
						<View style={{ flex: 1 }}>
							<Field label="State">
								<Input
									value={draft.state}
									onChangeText={(v) => set("state", v)}
									style={inputStyle}
								/>
								<FieldError message={errors.state} />
							</Field>
						</View>
					</View>

					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<View style={{ flex: 1 }}>
							<Field label="Pincode">
								<Input
									value={draft.pincode}
									onChangeText={(v) => set("pincode", v)}
									keyboardType="number-pad"
									style={inputStyle}
								/>
								<FieldError message={errors.pincode} />
							</Field>
						</View>
						<View style={{ flex: 1 }}>
							<Field label="Team size">
								<Input
									value={draft.teamSize}
									onChangeText={(v) => set("teamSize", v.replace(/\D/g, ""))}
									keyboardType="number-pad"
									style={inputStyle}
								/>
								<FieldError message={errors.teamSize} />
							</Field>
						</View>
						<View style={{ flex: 1 }}>
							<Field label="Founded">
								<Input
									placeholder="2015"
									value={draft.foundingYear}
									onChangeText={(v) =>
										set("foundingYear", v.replace(/\D/g, ""))
									}
									keyboardType="number-pad"
									style={inputStyle}
								/>
								<FieldError message={errors.foundingYear} />
							</Field>
						</View>
					</View>

					<View style={{ height: spacing[6] }} />
					<Button onPress={submit} loading={updateOrganization.isPending}>
						Save changes
					</Button>
				</ScrollView>
			</View>
		</Modal>
	);
}

function seed(organization: OrganizationDetail | undefined): Draft {
	return {
		organizationName: organization?.organizationName ?? "",
		email: organization?.email ?? "",
		phone: organization?.phone ?? "",
		website: organization?.website ?? "",
		description: organization?.description ?? "",
		mission: organization?.mission ?? "",
		address: organization?.address ?? "",
		city: organization?.city ?? "",
		state: organization?.state ?? "",
		pincode: organization?.pincode ?? "",
		teamSize: organization?.teamSize ? String(organization.teamSize) : "",
		foundingYear: organization?.foundingYear
			? String(organization.foundingYear)
			: "",
	};
}

function Field({
	label,
	optional,
	children,
}: {
	label: string;
	optional?: boolean;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ marginBottom: spacing[5] }}>
			<Label style={{ marginBottom: spacing[1.5] }}>
				{label}{" "}
				{optional ? <Caption color="tertiary">(optional)</Caption> : null}
			</Label>
			{children}
		</View>
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
