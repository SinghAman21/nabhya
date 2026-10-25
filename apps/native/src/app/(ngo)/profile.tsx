import { ORG_DOCUMENT_LABELS } from "@nabhya/shared";
import { useRouter } from "expo-router";
import { Bell, Lock, LogOut, Moon, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { ImageEditButton, OrgCover, OrgLogo } from "@/components/org-branding";
import { PageTabs } from "@/components/page-tabs";
import {
	Banner,
	ErrorState,
	type Fact,
	FactList,
	ListGroup,
	ListRow,
	LoadingState,
	MetricRow,
	Screen,
	ScreenHeader,
	SectionTitle,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { StepIndicator } from "@/components/step-indicator";
import { Button } from "@/components/ui/button";
import { Sheet, SheetOption } from "@/components/ui/sheet";
import { Body, Caption, H3, Label } from "@/components/ui/typography";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useSignOut } from "@/hooks/use-auth";
import { useOrganizationImpact } from "@/hooks/use-directory";
import { useMyOrgDocuments } from "@/hooks/use-documents";
import { useMyOrganization } from "@/hooks/use-organization";
import { useTheme } from "@/hooks/use-theme";
import { useMedia } from "@/hooks/useMedia";
import { apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
	currentDocumentsByType,
	ORG_OPTIONAL_DOCUMENTS,
	ORG_REQUIRED_DOCUMENTS,
	ORG_VERIFICATION_STEPS,
	type OrgDocumentSpec,
	orgDocumentState,
	orgVerificationCopy,
	orgVerificationStep,
} from "@/lib/org-verification";
import { verticalScrollbar } from "@/lib/scroll";

/**
 * The organisation's own page: one hero that says who you are, then tabs.
 *
 * ## Why tabs and not one long column
 *
 * A profile carries four unrelated kinds of thing - the public record, the
 * numbers, the legal review, the account controls - and they are wanted at
 * different times. Stacked in one column they made a page you scrolled past
 * rather than read, and put "Appearance" three screens below the fold. Tabs
 * are a *page* device here, not a navigation one: `PageTabs` keeps them in
 * local state, so all three are one route, one back-stack entry, and one
 * shared hero.
 *
 * ## The order
 *
 * 1. **Hero** - cover, logo, name, city, verification line, and the two things
 *    an owner does from here: view the public page, edit the record. Always
 *    visible, on every tab, because it is the answer to "whose page is this".
 * 2. **The verification banner**, above the tabs and outside them, while the
 *    organisation is not verified. It gates events, needs and posts going
 *    public, so it outranks whichever tab you happen to be on.
 * 3. **Overview** - what a volunteer or donor would see: impact, about, causes,
 *    contact, at a glance.
 * 4. **Verification** - where the review stands and what each document is
 *    doing, read-only, with one way through to `(ngo)/verification`, which owns
 *    uploading.
 *
 * ## Why there is no Settings tab
 *
 * There were five rows on it and four had another door within reach: Edit
 * profile and Your public page are the hero's own two buttons, Verification is
 * the tab beside it, and on desktop the rail footer already carries Appearance
 * and Sign out. A tab whose contents are all shortcuts to things already on
 * screen is a tab that teaches people the page has less on it than it does.
 *
 * What survived is the genuinely undoored: **Notifications**, which has exactly
 * one entry point in the whole NGO experience (`components/notification-bell.tsx`
 * exists but is mounted nowhere), plus Appearance and Sign out **on mobile
 * only**, where there is no rail footer to hold them. Those sit in an Account
 * block at the end of Overview rather than behind a tab of their own.
 *
 * ## What it deliberately does not carry
 *
 * No "Manage" list of Events / Needs / Updates / Reviews / Donations / Reports
 * / Team. Every one of those is a tab-bar or sidebar destination, and
 * `(ngo)/dashboard.tsx` already keeps a platform-aware list of the ones the phone's
 * tab bar cannot fit. A hub that restates the navigation is a hub people learn
 * to scroll past.
 *
 * No document *upload* tiles. `(ngo)/verification.tsx` owns those, with the
 * required/optional split, the per-document reviewer notes and the step
 * indicator. Two places to upload the same PAN card is how one of them ends up
 * being the one that never showed the rejection.
 */

/**
 * Desktop is two columns, roughly two-thirds and one-third.
 *
 * The wide column takes what is read in sequence - the numbers, the prose, the
 * contact details. The narrow one takes what is *looked up*: registration
 * number, founding year, team size. Facts of that kind read better in a column
 * you scan than as rows stretched across a 1000pt page, which is what the
 * whole screen used to be.
 */
const MAIN_COLUMN = 2;
const ASIDE_COLUMN = 1;

/** Caps the page on a wide monitor. 1080 is where a prose column stops helping. */
const PAGE: ViewStyle = {
	width: "100%",
	maxWidth: 1080,
	alignSelf: "center",
};

const APPEARANCE_LABEL = { system: "System", light: "Light", dark: "Dark" };

const ORG_TYPE_LABEL: Record<string, string> = {
	TRUST: "Trust",
	SOCIETY: "Society",
	SECTION_8: "Section 8 company",
	OTHERS: "Other",
};

type Tab = "overview" | "verification";

export default function NgoProfile() {
	const { colors, spacing } = useTheme();
	const { preference, setColorScheme } = useAppTheme();
	const router = useRouter();
	const signOut = useSignOut();
	const { isDesktop } = useMedia();

	const [tab, setTab] = useState<Tab>("overview");
	const [appearanceOpen, setAppearanceOpen] = useState(false);

	const org = useMyOrganization();
	const data = org.data;

	const status = data?.verificationStatus;
	const isVerified = status === "VERIFIED";
	const impact = useOrganizationImpact(isVerified ? data?.id : undefined);
	const documents = useMyOrgDocuments();

	/** One source for the banner copy, its tone, and the short state label. */
	const verification = orgVerificationCopy(status, data?.rejectionReason);
	const location = [data?.city, data?.state].filter(Boolean).join(", ");

	const goEdit = () => router.push("/(ngo)/edit");
	const goVerification = () => router.push("/(ngo)/verification");

	if (org.isLoading || org.isError || !data) {
		return (
			<Screen>
				<View style={PAGE}>
					<ScreenHeader title="Profile" />
				</View>
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

	/* ---------------------------------------------------------------------- */
	/* Hero                                                                   */
	/* ---------------------------------------------------------------------- */

	const logoSize = isDesktop ? 96 : 76;
	/*
	 * Only the logo rides up over the cover. Pulling the whole block up would
	 * drag the name with it - at these sizes the name's own height is greater
	 * than what is left of the logo below the cover, so the text would land on
	 * top of the photo.
	 */
	const logoOverlap = Math.round(logoSize * 0.45);

	/*
	 * Beside the logo on desktop, a full-width pair under the name on a phone.
	 * `flex: 1` only on the phone: on desktop the row is right-aligned against
	 * the logo and stretching the buttons would push them across the hero.
	 */
	const actionStyle = isDesktop ? undefined : { flex: 1 };
	const actions = (
		<View style={{ flexDirection: "row", gap: spacing[2] }}>
			{/* The public page 404s until the NGO is verified - there is nothing
			    public yet - so the button only exists once there is. */}
			{isVerified && (
				<Button
					variant="outline"
					size="sm"
					style={actionStyle}
					onPress={() => router.push(`/ngos/${data.id}`)}
					accessibilityLabel="View public page"
				>
					{/* Half a 390pt row cut "View public page" to "View public pa…". */}
					{isDesktop ? "View public page" : "Public page"}
				</Button>
			)}
			<Button size="sm" style={actionStyle} onPress={goEdit}>
				Edit profile
			</Button>
		</View>
	);

	const hero = (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			<OrgCover
				imageKey={data.coverImage}
				height={isDesktop ? 184 : 124}
				action={<ImageEditButton label="Change cover photo" onPress={goEdit} />}
			/>

			<View
				style={{
					paddingHorizontal: spacing[5],
					paddingBottom: spacing[5],
				}}
			>
				<View
					style={{
						marginTop: -logoOverlap,
						marginBottom: spacing[3],
						flexDirection: "row",
						alignItems: "flex-end",
						justifyContent: "space-between",
						gap: spacing[4],
						// Paints the logo over the cover it overlaps. Later siblings
						// win on the web anyway; Android needs it spelled out.
						zIndex: 1,
					}}
				>
					<OrgLogo
						name={data.organizationName}
						imageKey={data.logo}
						size={logoSize}
						ring
						badge={
							<ImageEditButton label="Change logo" onPress={goEdit} size={28} />
						}
					/>
					{isDesktop ? actions : null}
				</View>

				<H3 numberOfLines={2}>{data.organizationName}</H3>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						flexWrap: "wrap",
						gap: spacing[2],
						marginTop: spacing[1],
					}}
				>
					{location ? (
						<Caption color="tertiary">{location}</Caption>
					) : (
						<Caption color="quaternary">Add your city</Caption>
					)}
					{/* On a phone the badge wraps to its own line, which left the
					    dot dangling at the end of the city. */}
					{isDesktop ? <Caption color="quaternary">·</Caption> : null}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: spacing[1],
						}}
					>
						<ShieldCheck
							size={13}
							strokeWidth={2.2}
							color={
								isVerified
									? (colors.success.ink as string)
									: (colors.text.quaternary as string)
							}
						/>
						<Caption
							weight="medium"
							color={
								isVerified
									? (colors.success.ink as string)
									: (colors.text.quaternary as string)
							}
						>
							{isVerified ? "Verified organisation" : "Not verified yet"}
						</Caption>
					</View>
				</View>

				{isDesktop ? null : (
					<View style={{ marginTop: spacing[4] }}>{actions}</View>
				)}
			</View>
		</Surface>
	);

	/* ---------------------------------------------------------------------- */
	/* Overview                                                               */
	/* ---------------------------------------------------------------------- */

	const numbers =
		isVerified && impact.data ? (
			<MetricRow
				stats={[
					{ label: "Followers", value: data.followerCount ?? 0 },
					{ label: "Events hosted", value: impact.data.eventsHosted ?? 0 },
					{
						label: "Volunteers engaged",
						value: impact.data.volunteersEngaged ?? 0,
					},
					{ label: "Needs fulfilled", value: impact.data.needsFulfilled ?? 0 },
				]}
			/>
		) : null;

	const about =
		data.description || data.mission || data.vision ? (
			<View>
				<SectionTitle>About</SectionTitle>
				<Surface>
					<View style={{ gap: spacing[4] }}>
						{data.description ? <Body>{data.description}</Body> : null}
						{data.mission ? (
							<View style={{ gap: spacing[1] }}>
								<Label color="tertiary">Mission</Label>
								<Body color="secondary">{data.mission}</Body>
							</View>
						) : null}
						{data.vision ? (
							<View style={{ gap: spacing[1] }}>
								<Label color="tertiary">Vision</Label>
								<Body color="secondary">{data.vision}</Body>
							</View>
						) : null}
					</View>
				</Surface>
			</View>
		) : (
			<View>
				<SectionTitle>About</SectionTitle>
				<Surface onPress={goEdit}>
					<Body color="secondary">
						No description yet. This is the first thing a volunteer reads on
						your public page.
					</Body>
					<Caption
						color={colors.primary.ink as string}
						weight="medium"
						style={{ marginTop: spacing[2] }}
					>
						Add a description
					</Caption>
				</Surface>
			</View>
		);

	const causes = (
		<View>
			<SectionTitle>Causes</SectionTitle>
			{data.categories && data.categories.length > 0 ? (
				<View
					style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
				>
					{data.categories.map((category) => (
						<View
							key={category.id}
							style={{
								paddingHorizontal: spacing[3],
								paddingVertical: spacing[1.5],
								borderRadius: 999,
								backgroundColor: colors.background.subtle,
								borderWidth: 1,
								borderColor: colors.border.hairline,
							}}
						>
							<Caption weight="medium" color="secondary">
								{category.name}
							</Caption>
						</View>
					))}
				</View>
			) : (
				<Surface onPress={goEdit}>
					<Body color="secondary">
						No causes chosen. Volunteers filter the feed by these, so an
						organisation with none is hard to find.
					</Body>
				</Surface>
			)}
		</View>
	);

	const contactFacts: Fact[] = [
		{ label: "Phone", value: data.phone },
		{ label: "Email", value: data.email },
		{ label: "Website", value: data.website },
		{
			label: "Address",
			value: [data.address, location, data.pincode].filter(Boolean).join("\n"),
		},
	];

	// `FactList` drops empty facts and renders nothing when every one is empty,
	// so the heading has to be conditional too or it labels a gap.
	const contact = contactFacts.some((fact) => Boolean(fact.value)) ? (
		<View>
			<SectionTitle>Contact</SectionTitle>
			<FactList facts={contactFacts} />
		</View>
	) : (
		<View>
			<SectionTitle>Contact</SectionTitle>
			<Surface onPress={goEdit}>
				<Body color="secondary">
					No contact details yet. Volunteers and donors have no way to reach
					you.
				</Body>
			</Surface>
		</View>
	);

	const registryFacts: Fact[] = [
		{
			label: "Registered as",
			value: data.orgType
				? (ORG_TYPE_LABEL[data.orgType] ?? data.orgType)
				: null,
		},
		{ label: "Registration number", value: data.registrationNumber },
		{
			label: "Founded",
			value: data.foundingYear ? `${data.foundingYear}` : null,
		},
		{
			label: "Team size",
			value: data.teamSize ? `${data.teamSize} people` : null,
		},
		{ label: "On Nabhya since", value: formatDate(data.createdAt) },
	];

	const registry = (
		<View>
			<SectionTitle>At a glance</SectionTitle>
			<FactList facts={registryFacts} />
		</View>
	);

	/* ---------------------------------------------------------------------- */
	/* Verification                                                           */
	/* ---------------------------------------------------------------------- */

	const byType = currentDocumentsByType(documents.data);
	const requiredUploaded = ORG_REQUIRED_DOCUMENTS.filter((spec) =>
		byType.has(spec.type),
	).length;

	const documentRows = (specs: OrgDocumentSpec[], required: boolean) => (
		<ListGroup>
			{specs.map((spec) => {
				const existing = byType.get(spec.type);
				const state = orgDocumentState(existing?.verificationStatus);
				return (
					<ListRow
						key={spec.type}
						label={ORG_DOCUMENT_LABELS[spec.type] ?? spec.type}
						hint={
							existing?.remarks
								? `Reviewer: ${existing.remarks}`
								: required
									? "Required for review"
									: "Optional"
						}
						value={<StatusPill label={state.label} tone={state.tone} />}
						onPress={goVerification}
					/>
				);
			})}
		</ListGroup>
	);

	const verificationMain = (
		<View style={{ gap: spacing[6] }}>
			<Surface>
				<StepIndicator
					steps={ORG_VERIFICATION_STEPS}
					currentStep={orgVerificationStep(status, requiredUploaded)}
					embedded
				/>
			</Surface>

			{documents.isLoading ? (
				<LoadingState />
			) : (
				<>
					<View>
						<SectionTitle>Required</SectionTitle>
						{documentRows(ORG_REQUIRED_DOCUMENTS, true)}
					</View>
					<View>
						<SectionTitle>Optional</SectionTitle>
						{documentRows(ORG_OPTIONAL_DOCUMENTS, false)}
					</View>
				</>
			)}
		</View>
	);

	/*
	 * This tab reports; it does not act. Uploading, replacing and reading a
	 * reviewer's full notes live on `(ngo)/verification`, so the aside is the
	 * state plus the one way through to it. A rejected document's remark is
	 * surfaced on its row here, though, because that is the one piece of the
	 * other screen you should not have to navigate to discover.
	 */
	const verificationAside = (
		<View style={{ gap: spacing[6] }}>
			<Surface>
				<View style={{ gap: spacing[3] }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							gap: spacing[3],
						}}
					>
						<Label color="tertiary">Status</Label>
						<StatusPill label={verification.label} tone={verification.tone} />
					</View>
					<Body weight="medium">{verification.title}</Body>
					<Caption color="tertiary">{verification.description}</Caption>
					<Button variant="outline" onPress={goVerification}>
						{isVerified ? "View documents" : "Manage documents"}
					</Button>
				</View>
			</Surface>

			<Surface>
				<View style={{ flexDirection: "row", gap: spacing[3] }}>
					<Lock
						size={18}
						strokeWidth={1.75}
						color={colors.text.tertiary as string}
					/>
					<View style={{ flex: 1, gap: spacing[1] }}>
						<Label>Never shown publicly</Label>
						<Caption color="tertiary">
							Documents are private to you and the reviewer. Verification shows
							as a badge; the paper behind it does not.
						</Caption>
					</View>
				</View>
			</Surface>
		</View>
	);

	const verificationPanel = isDesktop ? (
		<View style={{ flexDirection: "row", gap: spacing[6] }}>
			<View style={{ flex: MAIN_COLUMN, minWidth: 0 }}>{verificationMain}</View>
			<View style={{ flex: ASIDE_COLUMN, minWidth: 0 }}>
				{verificationAside}
			</View>
		</View>
	) : (
		<View style={{ gap: spacing[6] }}>
			{verificationAside}
			{verificationMain}
		</View>
	);

	/* ---------------------------------------------------------------------- */
	/* Account                                                                */
	/* ---------------------------------------------------------------------- */

	/*
	 * Only what the surrounding chrome does not already offer. On desktop the
	 * rail footer carries Appearance and Sign out, so this is one row; on a
	 * phone there is no footer and it is three.
	 */
	const account = (
		<View>
			<SectionTitle>Account</SectionTitle>
			<ListGroup>
				<ListRow
					icon={Bell}
					label="Notifications"
					onPress={() => router.push("/notifications")}
				/>
				{isDesktop ? null : (
					<ListRow
						icon={Moon}
						label="Appearance"
						value={
							<Caption color="tertiary">{APPEARANCE_LABEL[preference]}</Caption>
						}
						onPress={() => setAppearanceOpen(true)}
					/>
				)}
				{isDesktop ? null : (
					<ListRow
						icon={LogOut}
						label="Sign out"
						chevron={false}
						value={
							signOut.isPending ? (
								<Caption color="tertiary">Signing out…</Caption>
							) : undefined
						}
						onPress={() => signOut.mutate()}
					/>
				)}
			</ListGroup>
			{data.email ? (
				<Caption
					color="quaternary"
					numberOfLines={1}
					style={{ marginTop: spacing[2] }}
				>
					Signed in as {data.email}
				</Caption>
			) : null}
		</View>
	);

	/* ---------------------------------------------------------------------- */
	/* Assembly                                                               */
	/* ---------------------------------------------------------------------- */

	/**
	 * Both panels split the same way on desktop, and for the same reason: read
	 * on the left, look up and act on the right. On a phone the aside's contents
	 * fall in after the wide column's, except on Verification, where the state
	 * and the way through to the upload screen go first - being told where the
	 * review stands matters more than which of four slots is filled.
	 */
	const overviewPanel = isDesktop ? (
		<View style={{ flexDirection: "row", gap: spacing[6] }}>
			<View style={{ flex: MAIN_COLUMN, minWidth: 0, gap: spacing[6] }}>
				{numbers}
				{about}
				{causes}
			</View>
			<View style={{ flex: ASIDE_COLUMN, minWidth: 0, gap: spacing[6] }}>
				{registry}
				{contact}
				{account}
			</View>
		</View>
	) : (
		<View style={{ gap: spacing[6] }}>
			{numbers}
			{about}
			{causes}
			{contact}
			{registry}
			{account}
		</View>
	);

	return (
		<Screen>
			<View style={PAGE}>
				<ScreenHeader title="Profile" />
			</View>

			<ScrollView
				{...verticalScrollbar}
				contentContainerStyle={{ paddingBottom: spacing[10] }}
				refreshControl={
					isDesktop ? undefined : (
						<RefreshControl
							refreshing={org.isRefetching || documents.isRefetching}
							onRefresh={() => {
								org.refetch();
								documents.refetch();
								if (isVerified) impact.refetch();
							}}
							tintColor={colors.text.quaternary as string}
						/>
					)
				}
			>
				<View style={PAGE}>
					{hero}

					{isVerified ? null : (
						<View style={{ marginTop: spacing[5] }}>
							<Banner
								tone={verification.tone}
								title={verification.title}
								description={verification.description}
								onPress={goVerification}
							/>
						</View>
					)}

					<View style={{ marginTop: spacing[6] }}>
						<PageTabs
							value={tab}
							onChange={setTab}
							tabs={[
								{ value: "overview", label: "Overview" },
								{
									value: "verification",
									label: "Verification",
									alert: !isVerified,
								},
							]}
						/>
					</View>

					{tab === "overview" ? overviewPanel : null}
					{tab === "verification" ? verificationPanel : null}
				</View>
			</ScrollView>

			<Sheet
				visible={appearanceOpen}
				onClose={() => setAppearanceOpen(false)}
				title="Appearance"
				subtitle="System follows your phone's setting."
			>
				<View style={{ paddingBottom: spacing[2] }}>
					{(["system", "light", "dark"] as const).map((option) => (
						<SheetOption
							key={option}
							label={APPEARANCE_LABEL[option]}
							selected={preference === option}
							onPress={() => {
								setColorScheme(option);
								setAppearanceOpen(false);
							}}
						/>
					))}
				</View>
			</Sheet>
		</Screen>
	);
}
