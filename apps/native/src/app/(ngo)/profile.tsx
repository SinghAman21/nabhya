import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	CalendarDays,
	ChevronRight,
	FileText,
	HandCoins,
	HeartHandshake,
	Megaphone,
	Pencil,
	Star,
	Users,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { AppearanceRow } from "@/components/appearance-row";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import { PostComposerSheet } from "@/components/post-composer-sheet";
import {
	ErrorState,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import {
	humanizeStatus,
	StatusPill,
	verificationTone,
} from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Body, Caption } from "@/components/ui/typography";
import { useSignOut } from "@/hooks/use-auth";
import { useMyOrgDocuments, useUploadOrgDocument } from "@/hooks/use-documents";
import { useFeed } from "@/hooks/use-feed";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { splitPostText } from "@/lib/post-text";
import type { FeedItem } from "@/lib/types";

const MANAGEMENT_LINKS = [
	{ label: "Edit profile", href: "/(ngo)/edit", icon: Pencil },
	{ label: "Updates", href: "/(ngo)/announcements", icon: Megaphone },
	{ label: "Reviews", href: "/(ngo)/reviews", icon: Star },
	{ label: "Team", href: "/(ngo)/team", icon: Users },
	{ label: "Donations", href: "/(ngo)/donations", icon: HandCoins },
	{ label: "Transparency", href: "/(ngo)/reports", icon: FileText },
] as const;

const REQUIRED_DOCUMENTS: Array<{
	type: UploadOrgDocumentInput["documentType"];
	hint: string;
}> = [
	{
		type: "NGO_REGISTRATION_CERTIFICATE",
		hint: "Trust / Society / Section 8 registration document",
	},
	{ type: "PAN_CARD", hint: "Organization PAN card" },
	{ type: "80G_CERTIFICATE", hint: "Optional — enables tax-deductible giving" },
	{ type: "12A_CERTIFICATE", hint: "Optional — tax exemption registration" },
];

export default function NgoProfile() {
	const { colors, spacing } = useTheme();
	const router = useRouter();
	const signOut = useSignOut();
	const org = useMyOrganization();
	const documents = useMyOrgDocuments();
	const upload = useUploadOrgDocument();
	const postsFeed = useFeed({ kind: "post" });
	const [composerOpen, setComposerOpen] = useState(false);
	const [composerKey, setComposerKey] = useState(0);

	const data = org.data;
	const byType = new Map(
		(documents.data ?? []).map((document) => [document.documentType, document]),
	);
	const posts = useMemo(
		() =>
			postsFeed.data?.pages
				.flatMap((page) => page.items)
				.filter(
					(item): item is FeedItem & { kind: "post" } =>
						item.kind === "post" && item.organization?.id === data?.id,
				) ?? [],
		[data?.id, postsFeed.data],
	);

	const submit = (
		documentType: UploadOrgDocumentInput["documentType"],
		documentKey: string,
	) => {
		upload.mutate(
			{ documentType, documentKey },
			{
				onError: (error) =>
					Alert.alert("Could not save document", apiErrorMessage(error)),
			},
		);
	};

	if (org.isLoading) {
		return (
			<Screen>
				<ScreenHeader title="Profile" />
				<LoadingState />
			</Screen>
		);
	}

	if (org.isError || !data) {
		return (
			<Screen>
				<ScreenHeader title="Profile" />
				<ErrorState
					message={apiErrorMessage(org.error)}
					onRetry={() => org.refetch()}
				/>
			</Screen>
		);
	}

	return (
		<Screen>
			<ScreenHeader title="Profile" />
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: spacing[10] }}
				refreshControl={
					<RefreshControl
						refreshing={org.isRefetching || documents.isRefetching}
						onRefresh={() => {
							org.refetch();
							documents.refetch();
						}}
						tintColor={colors.primary.main as string}
					/>
				}
			>
				<View style={{ gap: spacing[2], marginBottom: spacing[5] }}>
					{MANAGEMENT_LINKS.map(({ label, href, icon: Icon }) => (
						<Surface key={href} onPress={() => router.push(href as never)}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing[3],
								}}
							>
								<Icon size={18} color={colors.text.secondary as string} />
								<Body weight="medium" style={{ flex: 1 }}>
									{label}
								</Body>
								<ChevronRight
									size={18}
									color={colors.text.quaternary as string}
								/>
							</View>
						</Surface>
					))}
				</View>

				<Surface style={{ marginBottom: spacing[5] }}>
					<Body weight="bold">{data.organizationName}</Body>
					<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
						{[
							data.orgType,
							data.foundingYear ? `Founded ${data.foundingYear}` : null,
						]
							.filter(Boolean)
							.join(" · ")}
					</Caption>
					<Caption color="secondary" style={{ marginTop: spacing[2] }}>
						Your organization profile and verification details.
					</Caption>
					{data.id ? (
						<Button
							variant="outline"
							size="sm"
							onPress={() => router.push(`/ngos/${data.id}` as never)}
							style={{ marginTop: spacing[3] }}
						>
							Public profile
						</Button>
					) : null}
				</Surface>

				<View style={{ marginTop: spacing[6], marginBottom: spacing[6] }}>
					<Body weight="bold" style={{ marginBottom: spacing[3] }}>
						Programme
					</Body>
					<View style={{ flexDirection: "row", gap: spacing[3] }}>
						<Surface style={{ flex: 1 }}>
							<CalendarDays size={18} color={colors.primary.ink as string} />
							<Caption color="secondary" style={{ marginTop: spacing[2] }}>
								Events
							</Caption>
							<Body weight="bold">{data.stats?.events?.published ?? 0}</Body>
						</Surface>
						<Surface style={{ flex: 1 }}>
							<HeartHandshake size={18} color={colors.primary.ink as string} />
							<Caption color="secondary" style={{ marginTop: spacing[2] }}>
								Open needs
							</Caption>
							<Body weight="bold">{data.stats?.needs?.open ?? 0}</Body>
						</Surface>
					</View>
				</View>

				<Surface style={{ marginBottom: spacing[5] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							gap: spacing[3],
						}}
					>
						<Body weight="bold" style={{ flex: 1 }} numberOfLines={2}>
							{data.organizationName}
						</Body>
						<StatusPill
							label={humanizeStatus(data.verificationStatus)}
							tone={verificationTone(data.verificationStatus)}
						/>
					</View>
					<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
						{[data.city, data.state].filter(Boolean).join(", ")}
					</Caption>
					{data.rejectionReason ? (
						<View
							style={{
								marginTop: spacing[3],
								padding: spacing[3],
								borderRadius: 12,
								backgroundColor: colors.error.bg,
							}}
						>
							<Caption weight="bold" color={colors.error.main as string}>
								Verification rejected
							</Caption>
							<Caption color="secondary">{data.rejectionReason}</Caption>
						</View>
					) : null}
				</Surface>

				<Caption
					weight="bold"
					color="tertiary"
					style={{
						letterSpacing: 1,
						textTransform: "uppercase",
						marginBottom: spacing[3],
					}}
				>
					Verification documents
				</Caption>
				{documents.isLoading ? (
					<LoadingState />
				) : (
					REQUIRED_DOCUMENTS.map((document) => (
						<DocumentUploadTile
							key={document.type}
							title={ORG_DOCUMENT_LABELS[document.type] ?? document.type}
							hint={document.hint}
							purpose="ORG_DOCUMENT"
							existing={byType.get(document.type)}
							saving={upload.isPending}
							onUploaded={(key) => submit(document.type, key)}
						/>
					))
				)}

				<View style={{ marginTop: spacing[6], marginBottom: spacing[6] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: spacing[3],
						}}
					>
						<Body weight="bold">Posts</Body>
						<Button
							size="sm"
							onPress={() => {
								setComposerKey((value) => value + 1);
								setComposerOpen(true);
							}}
						>
							Create post
						</Button>
					</View>
					{posts.length === 0 ? (
						<Surface>
							<Caption color="tertiary">No posts yet.</Caption>
						</Surface>
					) : (
						<View style={{ gap: spacing[3] }}>
							{posts.map((post) => {
								const parsed = splitPostText(post.post.text);
								return (
									<Surface key={post.id}>
										{parsed.title ? (
											<Body weight="bold">{parsed.title}</Body>
										) : null}
										<Caption color="secondary" numberOfLines={4}>
											{parsed.description || post.post.text}
										</Caption>
									</Surface>
								);
							})}
						</View>
					)}
				</View>

				<Button
					variant="outline"
					onPress={() => signOut.mutate()}
					loading={signOut.isPending}
				>
					Sign out
				</Button>
				<AppearanceRow />
				{data.email ? (
					<Caption
						color="quaternary"
						numberOfLines={1}
						style={{ textAlign: "center", marginTop: spacing[3] }}
					>
						{data.email}
					</Caption>
				) : null}
			</ScrollView>
			<PostComposerSheet
				key={composerKey}
				visible={composerOpen}
				onClose={() => setComposerOpen(false)}
			/>
		</Screen>
	);
}
