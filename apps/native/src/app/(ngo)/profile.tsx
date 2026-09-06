import type { UploadOrgDocumentInput } from "@nabhya/shared";
import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { useRouter } from "expo-router";
import {
	ChevronRight,
	FileText,
	HandCoins,
	Megaphone,
	Pencil,
	Star,
	Users,
} from "lucide-react-native";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { DocumentUploadTile } from "@/components/document-upload-tile";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { AppearanceRow } from "@/components/appearance-row";
import { InitialAvatar } from "@/components/initial-avatar";
import { PostComposerSheet } from "@/components/post-composer-sheet";
import {
	ErrorState,
	LoadingState,
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
import { useOrgTeam } from "@/hooks/use-directory";
import { useMyOrgDocuments } from "@/hooks/use-documents";
import { useFeed } from "@/hooks/use-feed";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { apiErrorMessage } from "@/lib/api";
import { splitPostText } from "@/lib/post-text";
import type { FeedItem } from "@/lib/types";

/** Reached from here rather than the tab bar, which only has room for four. */
const MANAGEMENT_LINKS = [
	{ label: "Edit profile", href: "/(ngo)/edit", icon: Pencil },
	{ label: "Updates", href: "/(ngo)/announcements", icon: Megaphone },
	{ label: "Reviews", href: "/(ngo)/reviews", icon: Star },
	{ label: "Team", href: "/(ngo)/team", icon: Users },
	{ label: "Donations", href: "/(ngo)/donations", icon: HandCoins },
	{ label: "Transparency", href: "/(ngo)/reports", icon: FileText },
] as const;

/** Document types the verification queue expects, in the order we ask for them. */
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
	const team = useOrgTeam();
	const postsFeed = useFeed({ kind: "post" });
	const [composerOpen, setComposerOpen] = useState(false);
	const [composerKey, setComposerKey] = useState(0);

	const data = org.data;
	const status = data?.verificationStatus;
	const isVerified = status === "VERIFIED";

	// Latest submission per type — re-uploading supersedes rather than stacks.
	const byType = new Map(
		(documents.data ?? []).map((doc) => [doc.documentType, doc]),
	);

	const location = [data?.city, data?.state].filter(Boolean).join(", ");
	const causes = data?.categories?.map((c) => c.name).join(" · ");
	const posts = useMemo(
		() =>
			postsFeed.data?.pages
				.flatMap((page) => page.items)
				.filter(
					(item): item is FeedItem & { kind: "post" } =>
						item.kind === "post" && item.organization?.id === data?.id,
				) ?? [],
		[postsFeed.data, data?.id],
	);
	const typeLine = [
		data?.orgType,
		data?.foundingYear ? `Founded ${data.foundingYear}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	if (org.isLoading || org.isError) {
		return (
			<Screen>
				<ScreenHeader title="Profile" />
				{org.isLoading ? (
					<LoadingState />
				) : (
					<ErrorState
						message={apiErrorMessage(org.error)}
						onRetry={() => org.refetch()}
					/>
				)}
			</Screen>
		);
	}

	/* 1. Who we are ---------------------------------------------------------- */
	const identity = (
		<Surface
			onPress={() => router.push("/(ngo)/edit")}
			style={{ marginBottom: spacing[4] }}
		>
			<ScreenHeader
				title="Profile"
				subtitle="Your organization and its verification status."
			/>

			{org.isLoading ? (
				<LoadingState />
			) : org.isError ? (
				<ErrorState
					message={apiErrorMessage(org.error)}
					onRetry={() => org.refetch()}
				/>
				{data?.id && (
					<ListRow
						icon={Globe}
						label="Public profile"
						hint="What volunteers and donors see"
						onPress={() => router.push(`/ngos/${data.id}` as never)}
					/>
				)}
				<AppearanceRow />
			</ListGroup>
		</View>
	);

	const programme = (
		<View style={{ marginBottom: spacing[6] }}>
			<SectionTitle>Programme</SectionTitle>
			<ListGroup>
				<ListRow
					icon={CalendarDays}
					label="Events"
					value={
						<Caption color="tertiary">
							{data?.stats?.events?.published ?? 0} published
						</Caption>
					}
					onPress={() => router.push("/(ngo)/events")}
				/>
				<ListRow
					icon={HeartHandshake}
					label="Needs"
					value={
						<Caption color="tertiary">
							{data?.stats?.needs?.open ?? 0} open
						</Caption>
					}
					onPress={() => router.push("/(ngo)/needs")}
				/>
				<ListRow
					icon={Megaphone}
					label="Updates"
					onPress={() => router.push("/(ngo)/announcements")}
				/>
				<ListRow
					icon={Star}
					label="Reviews"
					onPress={() => router.push("/(ngo)/reviews")}
				/>
			</ListGroup>
		</View>
	);

	const postsSection = (
		<View style={{ marginBottom: spacing[6] }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: spacing[3],
				}}
			>
				<SectionTitle>Posts</SectionTitle>
				<View style={{ flexDirection: "row", gap: spacing[2] }}>
					<Button
						variant="outline"
						size="sm"
						onPress={() => router.push("/feed")}
					>
						View feed
					</Button>
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
			</View>
			{posts.length === 0 ? (
				<Surface>
					<Caption color="tertiary">
						No posts yet. Use the button above to publish your first update.
					</Caption>
				</Surface>
			) : (
				<View style={{ gap: spacing[3] }}>
					{posts.map((post) => {
						const parsed = splitPostText(post.post.text);
						return (
							<Surface key={post.id}>
								<View style={{ gap: spacing[1.5] }}>
									<Caption color="quaternary">
										{post.organization?.organizationName ??
											data?.organizationName}
									</Caption>
									{parsed.title ? <H3>{parsed.title}</H3> : null}
									<Caption
										color="secondary"
										numberOfLines={parsed.title ? 4 : 6}
									>
										{parsed.description || post.post.text}
									</Caption>
									<Caption color="quaternary">
										{post.post.media.length} media ·{" "}
										{new Date(post.postedAt).toLocaleDateString()}
									</Caption>
								</View>
							</Surface>
						);
					})}
				</View>
			)}
		</View>
	);

	const money = (
		<View style={{ marginBottom: spacing[8] }}>
			<SectionTitle>Money</SectionTitle>
			<ListGroup>
				<ListRow
					icon={HandCoins}
					label="Donations"
					onPress={() => router.push("/(ngo)/donations")}
				/>
				<ListRow
					icon={FileText}
					label="Reports"
					hint="Annual reports and audited statements"
					onPress={() => router.push("/(ngo)/reports")}
				/>
			</ListGroup>
		</View>
	);

	/* 5. Sign out ----------------------------------------------------------------- */
	const signOutButton = (
		<View style={{ gap: spacing[3], alignItems: "center" }}>
			<Button
				variant="outline"
				onPress={() => signOut.mutate()}
				loading={signOut.isPending}
				accessibilityLabel="Sign out"
				style={{ alignSelf: "stretch" }}
			>
				Sign out
			</Button>
			{data?.email && (
				<Caption color="quaternary" numberOfLines={1}>
					{data.email}
				</Caption>
			)}
		</View>
	);

	return (
		<Screen>
			<ScreenHeader title="Profile" />

			{isDesktop ? (
				<View style={{ flexDirection: "row", gap: spacing[6] }}>
					<View style={STICKY_RAIL}>
						{identity}
						{verification}
						{signOutButton}
					</View>
					<View style={{ flex: 1 }}>
						{numbers}
						{organisation}
						{programme}
						{postsSection}
						{money}
					</View>
				</View>
			) : (
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: spacing[10] }}
					refreshControl={
						<RefreshControl
							refreshing={org.isRefetching}
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
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: spacing[3],
							}}
						>
							<Body weight="bold" style={{ flex: 1 }} numberOfLines={2}>
								{org.data?.organizationName}
							</Body>
							<StatusPill
								label={humanizeStatus(org.data?.verificationStatus)}
								tone={verificationTone(org.data?.verificationStatus)}
							/>
						</View>
						<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
							{[org.data?.city, org.data?.state].filter(Boolean).join(", ")}
						</Caption>

						{org.data?.rejectionReason && (
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
								<Caption color="secondary">{org.data.rejectionReason}</Caption>
								<Caption color="tertiary" style={{ marginTop: spacing[1] }}>
									Upload a corrected document below to re-open review.
								</Caption>
							</View>
						)}
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
						REQUIRED_DOCUMENTS.map((doc) => (
							<DocumentUploadTile
								key={doc.type}
								title={ORG_DOCUMENT_LABELS[doc.type] ?? doc.type}
								hint={doc.hint}
								purpose="ORG_DOCUMENT"
								existing={byType.get(doc.type)}
								saving={upload.isPending}
								onUploaded={(key) => submit(doc.type, key)}
							/>
						))
					)}

					<Button
						variant="outline"
						onPress={() => signOut.mutate()}
						loading={signOut.isPending}
						style={{ marginTop: spacing[6] }}
					>
						Sign out
					</Button>
				</ScrollView>
			)}
		</View>
					{identity}
					{verification}
					{numbers}
					{organisation}
					{programme}
					{postsSection}
					{money}
					{signOutButton}
				</ScrollView>
			)}

			<PostComposerSheet
				key={composerKey}
				visible={composerOpen}
				onClose={() => setComposerOpen(false)}
			/>
		</Screen>
	);
}
