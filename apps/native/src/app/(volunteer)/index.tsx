import type { NeedType } from "@nabhya/shared";
import { BadgeCheck, HeartHandshake, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import type { ViewStyle } from "react-native";
import {
	Pressable,
	RefreshControl,
	ScrollView,
	TextInput,
	View,
} from "react-native";
import { ALL_INDIA, CityPicker } from "@/components/city-picker";
import { DiscoverRail } from "@/components/discover-rail";
import { NotificationBell } from "@/components/notification-bell";
import { PledgeSheet } from "@/components/pledge-sheet";
import {
	EmptyState,
	ErrorState,
	FilterChips,
	LoadingState,
	Screen,
	ScreenHeader,
	Surface,
} from "@/components/screen-shell";
import { StatusPill } from "@/components/status-pill";
import { Caption, H5, Label } from "@/components/ui/typography";
import { usePublicNeeds } from "@/hooks/use-needs";
import { useMe } from "@/hooks/use-profile";
import { useDebounced } from "@/hooks/useDebounced";
import { useMedia } from "@/hooks/useMedia";
import { useTheme } from "@/hooks/useTheme";
import { apiErrorMessage } from "@/lib/api";
import { focusWithin } from "@/lib/focus";
import { formatProgress, formatRelative } from "@/lib/format";
import type { PublicNeed } from "@/lib/types";
import { useFeedStore } from "@/store/feed-store";

/**
 * Discover — the volunteer feed.
 *
 * Exploration is by **intent**, not taxonomy. "All / Needed / Free to take" asked
 * the user to think in the NGO's vocabulary; urgency and location are what they
 * actually decide on. Both are real server filters — `publicNeedQuerySchema`
 * takes `urgency` and `city` — so nothing here reinterprets one page of results
 * on the client.
 */

type Intent = "ALL" | "URGENT" | NeedType;

const INTENTS: Array<{ value: Intent; label: string }> = [
	{ value: "ALL", label: "Everything" },
	{ value: "URGENT", label: "Urgent" },
	{ value: "WANT", label: "Needed" },
	{ value: "OFFER", label: "Free to take" },
];

/**
 * `position: "sticky"` is web-only and absent from React Native's `ViewStyle`
 * union, so the cast lives in one place instead of inside the screen.
 */
const STICKY_RAIL = {
	width: 320,
	position: "sticky",
	top: 0,
	alignSelf: "flex-start",
} as unknown as ViewStyle;

export default function Discover() {
	const { colors, spacing } = useTheme();
	const { isDesktop } = useMedia();
	const [intent, setIntent] = useState<Intent>("ALL");
	const [responding, setResponding] = useState<PublicNeed | null>(null);

	// One search field per platform, one value behind both: the top bar owns it on
	// desktop, the page owns it on mobile.
	const search = useFeedStore((s) => s.search);
	const setSearch = useFeedStore((s) => s.setSearch);
	const city = useFeedStore((s) => s.city);
	const setCity = useFeedStore((s) => s.setCity);
	const cityTouched = useFeedStore((s) => s.cityTouched);

	// Scope to the user's own city on first load, and only until they choose —
	// after that their choice stands for the session.
	const me = useMe();
	const homeCity = me.data?.city ?? null;
	useEffect(() => {
		if (!cityTouched && homeCity) setCity(homeCity);
	}, [cityTouched, homeCity, setCity]);

	const debouncedSearch = useDebounced(search.trim());

	const query = usePublicNeeds({
		search: debouncedSearch,
		...(city === ALL_INDIA ? {} : { city }),
		...(intent === "URGENT" ? { urgency: "HIGH" as const } : {}),
		...(intent === "WANT" || intent === "OFFER" ? { type: intent } : {}),
	});

	const needs = query.data?.items ?? [];

	const toolbar = (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				flexWrap: "wrap",
				gap: spacing[3],
				marginBottom: spacing[5],
				// Above the cards, so the city menu is not clipped by them.
				zIndex: 10,
			}}
		>
			<CityPicker value={city} onChange={setCity} homeCity={homeCity} />
			<FilterChips
				options={INTENTS}
				value={intent}
				onChange={setIntent}
				inline
			/>
		</View>
	);

	const body = query.isLoading ? (
		<LoadingState label="Finding posts" />
	) : query.isError ? (
		<ErrorState
			message={apiErrorMessage(query.error)}
			onRetry={() => query.refetch()}
		/>
	) : needs.length === 0 ? (
		<EmptyState
			icon={HeartHandshake}
			title={search ? "No matching posts" : "Nothing here yet"}
			description={
				search
					? "Try a different search term."
					: city === ALL_INDIA
						? "Verified NGOs will post what they need here."
						: `No open posts in ${city}.`
			}
			{...(city === ALL_INDIA
				? {}
				: {
						action: (
							<Pressable
								onPress={() => setCity(ALL_INDIA)}
								accessibilityRole="button"
								hitSlop={8}
							>
								<Label weight="semibold" color={colors.primary.ink}>
									Show all of India
								</Label>
							</Pressable>
						),
					})}
		/>
	) : (
		<NeedGrid
			needs={needs}
			columns={isDesktop ? 2 : 1}
			onRespond={(need) => setResponding(need)}
		/>
	);

	/*
	 * The whole page scrolls, rather than the feed scrolling inside a fixed frame.
	 * The rail is sticky on web so it holds its place while the feed moves.
	 */
	return (
		<Screen style={{ paddingHorizontal: 0 }}>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: spacing[5],
					paddingBottom: spacing[12],
				}}
				refreshControl={
					<RefreshControl
						refreshing={query.isRefetching}
						onRefresh={() => query.refetch()}
						tintColor={colors.text.quaternary as string}
					/>
				}
			>
				{isDesktop ? (
					// The top bar already carries the wordmark and the search field; a
					// page title and a result count would be chrome restating it.
					toolbar
				) : (
					<>
						<ScreenHeader title="Discover" action={<NotificationBell />} />
						<SearchField
							value={search}
							onChange={setSearch}
							pending={search.trim() !== debouncedSearch}
						/>
						<View style={{ height: spacing[3] }} />
						{toolbar}
					</>
				)}

				{isDesktop ? (
					<View style={{ flexDirection: "row", gap: spacing[6] }}>
						<View style={{ flex: 1 }}>{body}</View>
						<View style={STICKY_RAIL}>
							<DiscoverRail />
						</View>
					</View>
				) : (
					body
				)}
			</ScrollView>

			<PledgeSheet need={responding} onClose={() => setResponding(null)} />
		</Screen>
	);
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One shell holding the icon, the field and a clear button. The ring is drawn on
 * the shell via `focusWithin`, not on the bare input — see `src/global.css`.
 */
function SearchField({
	value,
	onChange,
	pending,
}: {
	value: string;
	onChange: (next: string) => void;
	/** True while a keystroke is still waiting on the debounce. */
	pending: boolean;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	return (
		<View
			{...focusWithin}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: spacing[2.5],
				height: 44,
				paddingHorizontal: spacing[3.5],
				borderRadius: borderRadius.md,
				backgroundColor: colors.background.subtle,
			}}
		>
			<Search
				size={17}
				color={colors.text.quaternary as string}
				strokeWidth={1.9}
			/>
			<TextInput
				value={value}
				onChangeText={onChange}
				placeholder="Search items, causes or NGOs"
				placeholderTextColor={colors.text.quaternary as string}
				autoCapitalize="none"
				returnKeyType="search"
				accessibilityLabel="Search posts"
				style={{
					flex: 1,
					fontFamily: "MonaSans",
					fontSize: 15,
					color: colors.text.primary as string,
					// No border and no padding: the shell owns both.
					borderWidth: 0,
					paddingVertical: 0,
				}}
			/>
			{value.length > 0 && (
				<Pressable
					onPress={() => onChange("")}
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					hitSlop={10}
					style={{ opacity: pending ? 0.5 : 1 }}
				>
					<X size={16} color={colors.text.tertiary as string} strokeWidth={2} />
				</Pressable>
			)}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Grid                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Cards flow to fit rather than sitting in a fixed grid: thirds were ~230px wide
 * at 769px and absurd at 1600px. One column on a phone, two beside the rail.
 */
function NeedGrid({
	needs,
	columns,
	onRespond,
}: {
	needs: PublicNeed[];
	columns: number;
	onRespond: (need: PublicNeed) => void;
}) {
	const { spacing } = useTheme();

	return (
		<View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[4] }}>
			{needs.map((need) => (
				<View
					key={need.id}
					style={
						columns === 1
							? { width: "100%" }
							: { flexGrow: 1, flexBasis: 300, maxWidth: 520 }
					}
				>
					<NeedCard need={need} onRespond={() => onRespond(need)} />
				</View>
			))}
		</View>
	);
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/**
 * A need, as a volunteer decides on it: who is asking, whether they are verified,
 * what for, how many are still needed, and by when.
 *
 * The four things that make someone act are specificity, proximity, trust and
 * social proof — so the card leads with the org and its verification mark, carries
 * the deadline, and treats progress as the protagonist.
 */
function NeedCard({
	need,
	onRespond,
}: {
	need: PublicNeed;
	onRespond: () => void;
}) {
	const { colors, spacing, borderRadius } = useTheme();

	const orgInitial =
		need.organization.organizationName?.charAt(0).toUpperCase() ?? "N";
	const verified = need.organization.verificationStatus === "VERIFIED";
	const place = need.city ?? need.organization.city ?? need.state ?? "India";

	const target = need.quantity ?? 0;
	const done = need.fulfilledQuantity ?? 0;
	const ratio = target > 0 ? Math.min(1, done / target) : 0;
	const remaining = Math.max(0, target - done);

	const expiresAt = need.expiresAt ? new Date(need.expiresAt) : null;
	const msLeft = expiresAt ? expiresAt.getTime() - Date.now() : null;
	const closingSoon = msLeft !== null && msLeft > 0 && msLeft < 3 * DAY_MS;
	const closed = need.status !== "OPEN" || (msLeft !== null && msLeft <= 0);

	return (
		<Surface padded={false} style={{ overflow: "hidden" }}>
			<View style={{ padding: spacing[4], gap: spacing[3] }}>
				{/* Who is asking */}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2.5],
					}}
				>
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: borderRadius.sm,
							backgroundColor: colors.background.subtle,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Label weight="bold">{orgInitial}</Label>
					</View>
					<View style={{ flex: 1 }}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: spacing[1],
							}}
						>
							<Label
								weight="semibold"
								numberOfLines={1}
								style={{ flexShrink: 1 }}
							>
								{need.organization.organizationName}
							</Label>
							{verified && (
								<BadgeCheck
									size={15}
									color={colors.info.ink}
									strokeWidth={2.2}
									accessibilityLabel="Verified NGO"
								/>
							)}
						</View>
						<Caption color="quaternary" numberOfLines={1}>
							{place} · {formatRelative(need.createdAt)}
						</Caption>
					</View>
					<StatusPill
						label={need.type === "WANT" ? "Needed" : "Free to take"}
						tone={need.type === "WANT" ? "info" : "success"}
					/>
				</View>

				{/* What for */}
				<View>
					<H5 numberOfLines={2}>{need.title}</H5>
					<Caption
						color="tertiary"
						numberOfLines={2}
						style={{ marginTop: spacing[1] }}
					>
						{need.description}
					</Caption>
				</View>

				{/* How many, and by when */}
				{target > 0 && (
					<View style={{ gap: spacing[2] }}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "baseline",
								justifyContent: "space-between",
								gap: spacing[2],
							}}
						>
							<Caption weight="medium">
								{formatProgress(done, need.quantity, need.unit)}
							</Caption>
							<Caption color="quaternary">
								{ratio >= 1
									? "Complete"
									: `${remaining} ${need.unit ?? "more"} to go`}
							</Caption>
						</View>
						<View
							style={{
								height: 4,
								borderRadius: 999,
								backgroundColor: colors.background.subtle,
								overflow: "hidden",
							}}
						>
							<View
								style={{
									width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%`,
									height: "100%",
									borderRadius: 999,
									backgroundColor:
										ratio >= 1
											? (colors.success.main as string)
											: (colors.primary.main as string),
								}}
							/>
						</View>
					</View>
				)}

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing[2],
					}}
				>
					{need.urgency === "HIGH" && !closed && (
						<StatusPill label="Urgent" tone="error" />
					)}
					{expiresAt && (
						<Caption color={closingSoon ? colors.warning.ink : "quaternary"}>
							{closed ? "Closed" : `Closes ${formatRelative(need.expiresAt)}`}
						</Caption>
					)}
				</View>
			</View>

			<View style={{ height: 1, backgroundColor: colors.border.hairline }} />

			<Pressable
				onPress={onRespond}
				disabled={closed}
				accessibilityRole="button"
				accessibilityState={{ disabled: closed }}
				accessibilityLabel={
					need.type === "WANT"
						? `Offer help with ${need.title}`
						: `Claim ${need.title}`
				}
				style={({ pressed }) => ({
					alignItems: "center",
					justifyContent: "center",
					paddingVertical: spacing[3.5],
					opacity: closed ? 0.45 : 1,
					backgroundColor: pressed
						? (colors.background.subtle as string)
						: "transparent",
				})}
			>
				<Label weight="semibold" color={colors.primary.ink}>
					{closed
						? "Closed"
						: need.type === "WANT"
							? "I can help"
							: "Claim this"}
				</Label>
			</Pressable>
		</Surface>
	);
}
