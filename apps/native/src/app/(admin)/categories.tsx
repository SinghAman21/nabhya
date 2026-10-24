import type { AdminCategory } from "@nabhya/shared";
import { Tags } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AdminScreen } from "@/components/admin/list-chrome";
import {
	EmptyState,
	ErrorState,
	SectionTitle,
	SkeletonList,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
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
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";

export default function AdminCategories() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
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

	const saving = create.isPending || update.isPending;
	const categories = query.data ?? [];
	const canSubmit = name.trim().length > 0 && slug.length > 0;
	// Per row, not one shared flag: a single `busy` spun every row's Archive
	// button at once while one of them was in flight.
	const rowBusy = (id: string) =>
		(archive.isPending && archive.variables === id) ||
		(update.isPending && update.variables?.id === id && editingId !== id);

	const form = (
		<Surface style={{ gap: spacing[3] }}>
			<SectionTitle>
				{editingId ? "Edit category" : "Add a category"}
			</SectionTitle>
			<Field label="Name">
				<Input
					value={name}
					maxLength={80}
					placeholder="Education"
					accessibilityLabel="Name"
					onChangeText={(value) => {
						setName(value);
						if (!slugEdited) setSlug(makeSlug(value));
					}}
				/>
			</Field>
			<Field label="Slug" hint="Lowercase, used in links and filters">
				<Input
					value={slug}
					maxLength={80}
					placeholder="education"
					accessibilityLabel="Slug"
					autoCapitalize="none"
					autoCorrect={false}
					onChangeText={(value) => {
						setSlugEdited(true);
						setSlug(makeSlug(value));
					}}
				/>
			</Field>
			<Field label="Description" hint="Optional">
				<Input
					value={description}
					maxLength={500}
					placeholder="A short explanation of this cause"
					accessibilityLabel="Description"
					onChangeText={setDescription}
					multiline
					style={{ minHeight: 72, textAlignVertical: "top" }}
				/>
			</Field>
			<Field label="Icon" hint="Optional - a Lucide icon name">
				<Input
					value={icon}
					maxLength={60}
					placeholder="BookOpen"
					accessibilityLabel="Icon"
					autoCapitalize="none"
					onChangeText={setIcon}
				/>
			</Field>
			<View style={{ flexDirection: "row", gap: spacing[2], flexWrap: "wrap" }}>
				<Button onPress={submit} loading={saving} disabled={!canSubmit}>
					{editingId ? "Save category" : "Create category"}
				</Button>
				{editingId && (
					<Button variant="outline" onPress={reset} disabled={saving}>
						Cancel
					</Button>
				)}
			</View>
		</Surface>
	);

	const list = (
		<View style={{ flex: 1, minWidth: 0 }}>
			<SectionTitle>
				{categories.length > 0
					? `Cause categories (${categories.length})`
					: "Cause categories"}
			</SectionTitle>
			{query.isLoading ? (
				<SkeletonList variant="row" count={6} label="Loading categories" />
			) : query.isError ? (
				<ErrorState
					message={apiErrorMessage(query.error)}
					onRetry={() => query.refetch()}
				/>
			) : categories.length === 0 ? (
				<EmptyState
					icon={Tags}
					title="No categories yet"
					description="Add the first cause - NGOs pick from these when they register."
				/>
			) : (
				// One card with hairline rows rather than a card per category: ten
				// stacked cards each carrying a red Archive button read as a column
				// of alarms, and the list is something to scan, not to look at.
				<Surface padded={false}>
					{categories.map((category, index) => (
						<View
							key={category.id}
							style={{
								flexDirection: "row",
								alignItems: "center",
								flexWrap: "wrap",
								gap: spacing[3],
								paddingHorizontal: spacing[4],
								paddingVertical: spacing[3],
								borderTopWidth: index === 0 ? 0 : 1,
								borderTopColor: colors.border.hairline,
								backgroundColor:
									editingId === category.id
										? colors.background.subtle
										: "transparent",
							}}
						>
							<View style={{ flex: 1, minWidth: 180, gap: spacing[0.5] }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: spacing[2],
									}}
								>
									<Body
										weight="semibold"
										numberOfLines={1}
										style={{ flexShrink: 1 }}
									>
										{category.name}
									</Body>
									{!category.isActive && (
										<StatusPill label="Archived" tone="neutral" />
									)}
								</View>
								<Caption color="quaternary" numberOfLines={1}>
									{category.slug}
									{category.icon ? ` · ${category.icon}` : ""}
								</Caption>
								{category.description ? (
									<Caption color="tertiary" numberOfLines={2}>
										{category.description}
									</Caption>
								) : null}
							</View>
							<View style={{ flexDirection: "row", gap: spacing[1.5] }}>
								<Button
									size="sm"
									variant="ghost"
									onPress={() => edit(category)}
									disabled={saving}
									accessibilityLabel={`Edit ${category.name}`}
								>
									Edit
								</Button>
								<Button
									size="sm"
									variant="outline"
									onPress={() => changeActive(category)}
									loading={rowBusy(category.id)}
									accessibilityLabel={`${category.isActive ? "Archive" : "Restore"} ${category.name}`}
								>
									{category.isActive ? "Archive" : "Restore"}
								</Button>
							</View>
						</View>
					))}
				</Surface>
			)}
		</View>
	);

	return (
		<AdminScreen
			title="Categories"
			subtitle="The causes NGOs register under and volunteers pick as interests"
		>
			{/* Desktop: the list takes the width and the form docks beside it at a
			    reading width - full-bleed inputs across a 2000pt page were a form
			    nobody could scan. Phone: the form, then the list. */}
			{isDesktop ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "flex-start",
						gap: spacing[6],
					}}
				>
					{list}
					<View style={{ width: 380, flexGrow: 0, flexShrink: 0 }}>{form}</View>
				</View>
			) : (
				<View style={{ gap: spacing[6] }}>
					{form}
					{list}
				</View>
			)}
		</AdminScreen>
	);
}

function Field({
	label,
	hint,
	children,
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	const { spacing } = useTheme();
	return (
		<View style={{ gap: spacing[1.5] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "baseline",
					gap: spacing[2],
				}}
			>
				<Label>{label}</Label>
				{hint ? <Caption color="quaternary">{hint}</Caption> : null}
			</View>
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
