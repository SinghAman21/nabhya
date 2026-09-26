import type {
	ApplicationQuery,
	ApplyToEventInput,
	CreateEventInput,
	OrgEventQuery,
	PublicEventQuery,
	ReviewApplicationInput,
	UpdateEventInput,
} from "@nabhya/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, orgEventsApi, queryKeys, queryScopes } from "@/lib/api";

// ─── Public / volunteer ──────────────────────────────────────────────────────

export function usePublicEvents(query: Partial<PublicEventQuery>) {
	return useQuery({
		queryKey: queryKeys.publicEvents(query),
		queryFn: () => eventsApi.listPublic(query),
	});
}

export function usePublicEvent(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.publicEvent(id ?? ""),
		queryFn: () => eventsApi.detail(id as string),
		enabled: !!id,
	});
}

export function useMyApplications(query: Partial<ApplicationQuery> = {}) {
	return useQuery({
		queryKey: queryKeys.myApplications(query),
		queryFn: () => eventsApi.myApplications(query),
	});
}

export function useApplyToEvent(eventId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ApplyToEventInput) => eventsApi.apply(eventId, input),
		onSuccess: () => {
			// The detail view carries `myApplication`, and the list shows capacity -
			// both change on apply.
			queryClient.invalidateQueries({ queryKey: queryScopes.events });
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

export function useWithdrawApplication(eventId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => eventsApi.withdraw(eventId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.events });
		},
	});
}

// ─── Organisation ────────────────────────────────────────────────────────────

export function useOrgEvents(
	query: Partial<OrgEventQuery> = {},
	/** Off for a screen that mounts a consumer it may never open. */
	enabled = true,
) {
	return useQuery({
		queryKey: queryKeys.orgEvents(query),
		queryFn: () => orgEventsApi.list(query),
		enabled,
	});
}

/** Full detail of one owned event - used to pre-fill the edit form. */
export function useOrgEvent(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.orgEvent(id ?? ""),
		queryFn: () => orgEventsApi.detail(id as string),
		enabled: !!id,
	});
}

export function useCreateEvent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateEventInput) => orgEventsApi.create(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryScopes.events });
			// The composer can create one of these straight from the feed, and
			// the ranking pool holds open needs, upcoming events and published
			// announcements - so the feed is stale the moment one is written,
			// whichever surface wrote it.
			queryClient.invalidateQueries({ queryKey: queryScopes.feed });
		},
	});
}

export function useUpdateEvent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdateEventInput }) =>
			orgEventsApi.update(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryScopes.events });
		},
	});
}

export function useDeleteEvent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => orgEventsApi.remove(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
			queryClient.invalidateQueries({ queryKey: queryScopes.events });
		},
	});
}

export function useEventApplicants(
	eventId: string | undefined,
	query: Partial<ApplicationQuery> = {},
) {
	return useQuery({
		queryKey: queryKeys.orgEventApplicants(eventId ?? "", query),
		queryFn: () => orgEventsApi.applicants(eventId as string, query),
		enabled: !!eventId,
	});
}

export function useReviewApplication(eventId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			applicationId,
			input,
		}: {
			applicationId: string;
			input: ReviewApplicationInput;
		}) => orgEventsApi.reviewApplication(eventId, applicationId, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryScopes.orgEvents });
		},
	});
}
