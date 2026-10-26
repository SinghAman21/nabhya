import { DEFAULT_CAUSE_CATEGORIES } from "@nabhya/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { categoriesApi, feedApi, orgDirectoryApi, queryKeys } from "@/lib/api";
import type { FeedItem } from "@/lib/types";
import type {
	DataState,
	LandingCause,
	LandingData,
	LandingOpportunity,
} from "./types";

const QUERY_OPTIONS = {
	staleTime: 5 * 60 * 1000,
	retry: false,
	refetchOnWindowFocus: false,
} as const;

function queryState(
	pending: boolean,
	error: boolean,
	length: number,
): DataState {
	return pending
		? "loading"
		: error
			? "unavailable"
			: length
				? "live"
				: "empty";
}

/** The landing page consumes the existing public APIs and their shared caches. */
export function useLandingData(): LandingData {
	const [selectedCause, onSelectCause] = useState<string | null>(null);
	const categories = useQuery({
		queryKey: queryKeys.categories,
		queryFn: categoriesApi.list,
		...QUERY_OPTIONS,
	});
	const causes: readonly LandingCause[] =
		categories.data ?? DEFAULT_CAUSE_CATEGORIES;
	const selected = causes.find((cause) => cause.slug === selectedCause);
	const filters = {
		kind: "EVENT" as const,
		page: 1,
		limit: 9,
		...(selected?.id ? { categoryIds: [selected.id] } : {}),
	};
	// An offline starter category has no UUID. Never send a made-up ID or
	// present unfiltered live results as belonging to that category.
	const canFilter = !selectedCause || Boolean(selected?.id);
	const feed = useQuery({
		queryKey: queryKeys.feed({ view: "for_you", ...filters }),
		queryFn: () => feedApi.forYou(filters),
		enabled: canFilter,
		...QUERY_OPTIONS,
	});
	const directoryFilters = { page: 1, limit: 100 };
	const directory = useQuery({
		queryKey: queryKeys.organizations(directoryFilters),
		queryFn: () => orgDirectoryApi.list(directoryFilters),
		...QUERY_OPTIONS,
	});
	const opportunitiesState = canFilter
		? queryState(feed.isPending, feed.isError, feed.data?.items.length ?? 0)
		: categories.isPending
			? "loading"
			: "unavailable";
	const liveOpportunities = (feed.data?.items ?? []).map((item) =>
		toOpportunity(item, selected?.name),
	);
	const organizationsState = queryState(
		directory.isPending,
		directory.isError,
		directory.data?.items.length ?? 0,
	);
	const organizations =
		organizationsState === "live"
			? (directory.data?.items ?? [])
					.filter((org) => Boolean(org.city))
					.map((org) => ({
						id: org.id,
						name: org.organizationName,
						city: org.city as string,
						state: org.state,
						description: org.description,
						category: org.categories?.[0]?.name,
						verified: org.verificationStatus === "VERIFIED",
						demo: org.id.startsWith("5eedf1e0-"),
						href: `/ngos/${org.id}`,
					}))
			: [];

	return {
		causes,
		selectedCause,
		onSelectCause,
		opportunitiesState,
		opportunities: opportunitiesState === "live" ? liveOpportunities : [],
		organizationsState,
		organizations,
		onRetry: () => {
			if (canFilter) void feed.refetch();
			void categories.refetch();
			void directory.refetch();
		},
	};
}

function toOpportunity(item: FeedItem, category?: string): LandingOpportunity {
	const org = item.organization;
	const base = {
		id: item.id,
		kind: item.kind,
		title:
			item.title ||
			(item.kind === "post" ? "An update from the community" : "An NGO update"),
		description: item.description,
		organization:
			org?.organizationName ?? item.author?.fullName ?? "Community member",
		verified:
			org?.verificationStatus === "VERIFIED" &&
			!item.id.startsWith("5eedf1e0-"),
		demo: item.id.startsWith("5eedf1e0-"),
		city: item.city ?? org?.city ?? null,
		category,
	};
	if (item.kind === "event")
		return {
			...base,
			// Seed walkthrough records may contain placeholder private keys.
			// Their real date/location remain useful without a failing image request.
			imageKey: base.demo ? null : item.event.coverImage,
			date: new Date(item.event.startAt).toLocaleDateString("en-IN", {
				day: "numeric",
				month: "short",
				timeZone: "Asia/Kolkata",
			}),
			fact: `${Math.max(0, item.event.volunteersNeeded - item.event.acceptedCount)} places available`,
			href: `/events/${item.id}`,
			action: "View opportunity",
		};
	if (item.kind === "need")
		return {
			...base,
			imageKey: item.need.coverImage,
			fact:
				item.need.type === "OFFER"
					? "Items being offered"
					: item.need.quantity === null
						? "Items needed"
						: `${Math.max(0, item.need.quantity - item.need.fulfilledQuantity)} ${item.need.unit ?? "items"} still needed`,
			href: `/needs/${item.id}`,
			action: "View community need",
		};
	return {
		...base,
		imageKey: item.kind === "story" ? item.story.coverImage : undefined,
		imageUrl:
			item.kind === "post"
				? item.post.media.find((media) => media.type === "IMAGE")?.url
				: undefined,
		href: org
			? `/ngos/${org.id}`
			: `/search?q=${encodeURIComponent(item.title || item.description.slice(0, 80))}&tab=updates`,
		action: org ? "Meet the organisation" : "Read the update",
	};
}
