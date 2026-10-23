import type { AdminCategory } from "@nabhya/shared";
import { useState } from "react";
import { View } from "react-native";
import { AdminScreen } from "@/components/admin/list-chrome";
import {
	ErrorState,
	LoadingState,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm, toast } from "@/components/ui/overlay";
import { Body, Caption, Label } from "@/components/ui/typography";
import {
	useAdminCategories,
	useArchiveAdminCategory,
	useCreateAdminCategory,
	useUpdateAdminCategory,
} from "@/hooks/use-admin";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";

export default function AdminCategories() {
	const { spacing } = useTheme();
	const query = useAdminCategories();
	const create = useCreateAdminCategory();
	const update = useUpdateAdminCategory();
	const archive = useArchiveAdminCategory();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugEdited, setSlugEdited] = useState(false);
	const [description, setDescription] = useState("");
	const [icon, setIcon] = useState("");

	const reset = () => {
		setEditingId(null);
		setName("");
		setSlug("");
		setSlugEdited(false);
		setDescription("");
		setIcon("");
	};

	const edit = (category: AdminCategory) => {
		setEditingId(category.id);
		setName(category.name);
		setSlug(category.slug);
		setSlugEdited(true);
		setDescription(category.description ?? "");
		setIcon(category.icon ?? "");
	};

	const submit = () => {
		const input = { name, slug, description, icon };
		const callbacks = {
			onSuccess: () => {
				toast.success(editingId ? "Category updated." : "Category created.");
				reset();
			},
			onError: (error: unknown) => toast.error(apiErrorMessage(error)),
		};
		if (editingId) update.mutate({ id: editingId, input }, callbacks);
		else create.mutate(input, callbacks);
	};

	const changeActive = async (category: AdminCategory) => {
		if (category.isActive) {
			const ok = await confirm({
				title: "Archive category?",
				message:
					"It will disappear from new selections. Existing NGO and volunteer assignments will be kept.",
				confirmLabel: "Archive",
			});
			if (!ok) return;
			archive.mutate(category.id, {
				onSuccess: () => toast.success("Category archived."),
				onError: (error) => toast.error(apiErrorMessage(error)),
			});
		} else {
			update.mutate(
				{ id: category.id, input: { isActive: true } },
				{
					onSuccess: () => toast.success("Category restored."),
					onError: (error) => toast.error(apiErrorMessage(error)),
				},
			);
		}
	};

	const busy = create.isPending || update.isPending || archive.isPending;
	const categories = query.data ?? [];

	return (
		<AdminScreen
			title="Categories"
			subtitle="Manage the causes used by NGO profiles and volunteer interests"
		>
			<View style={{ gap: spacing[5], paddingBottom: spacing[8] }}>
				<Surface style={{ padding: spacing[5], gap: spacing[3] }}>
					<SectionTitle>
						{editingId ? "Edit category" : "Add a category"}
					</SectionTitle>
					<Field label="Name">
						<Input
							value={name}
							maxLength={80}
							placeholder="Education"
							onChangeText={(value) => {
								setName(value);
								if (!slugEdited) setSlug(makeSlug(value));
							}}
						/>
					</Field>
					<Field label="Slug">
						<Input
							value={slug}
							maxLength={80}
							placeholder="education"
							autoCapitalize="none"
							autoCorrect={false}
							onChangeText={(value) => {
								setSlugEdited(true);
								setSlug(makeSlug(value));
							}}
						/>
					</Field>
					<Field label="Description (optional)">
						<Input
							value={description}
							maxLength={500}
							placeholder="A short explanation of this cause"
							onChangeText={setDescription}
							multiline
						/>
					</Field>
					<Field label="Lucide icon name (optional)">
						<Input
							value={icon}
							maxLength={60}
							placeholder="BookOpen"
							autoCapitalize="none"
							onChangeText={setIcon}
						/>
					</Field>
					<View
						style={{ flexDirection: "row", gap: spacing[2], flexWrap: "wrap" }}
					>
						<Button onPress={submit} loading={busy}>
							{editingId ? "Save category" : "Create category"}
						</Button>
						{editingId && (
							<Button variant="outline" onPress={reset} disabled={busy}>
								Cancel edit
							</Button>
						)}
					</View>
				</Surface>

				<View style={{ gap: spacing[3] }}>
					<SectionTitle>Cause categories</SectionTitle>
					{query.isLoading ? (
						<LoadingState />
					) : query.isError ? (
						<ErrorState
							message={apiErrorMessage(query.error)}
							onRetry={() => query.refetch()}
						/>
					) : categories.length === 0 ? (
						<Surface style={{ padding: spacing[5] }}>
							<Caption color="tertiary">No categories yet.</Caption>
						</Surface>
					) : (
						categories.map((category) => (
							<Surface key={category.id} style={{ padding: spacing[4] }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										flexWrap: "wrap",
										gap: spacing[3],
									}}
								>
									<View style={{ flex: 1, minWidth: 180, gap: spacing[1] }}>
										<Body weight="semibold">{category.name}</Body>
										<Caption color="tertiary">
											{category.slug}
											{category.icon ? ` · ${category.icon}` : ""}
										</Caption>
										{category.description ? (
											<Caption color="secondary">
												{category.description}
											</Caption>
										) : null}
										<Caption
											color={category.isActive ? "secondary" : "quaternary"}
										>
											{category.isActive ? "Active" : "Archived"}
										</Caption>
									</View>
									<Button
										size="sm"
										variant="outline"
										onPress={() => edit(category)}
									>
										Edit
									</Button>
									<Button
										size="sm"
										variant={category.isActive ? "destructive" : "outline"}
										onPress={() => changeActive(category)}
										loading={busy}
									>
										{category.isActive ? "Archive" : "Restore"}
									</Button>
								</View>
							</Surface>
						))
					)}
				</View>
			</View>
		</AdminScreen>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<View style={{ gap: 6 }}>
			<Label>{label}</Label>
			{children}
		</View>
	);
}

function makeSlug(value: string) {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}
