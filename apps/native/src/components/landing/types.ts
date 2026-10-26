import type { ReactNode } from "react";

export type DataState = "loading" | "live" | "empty" | "unavailable";
export type StoredImageRenderer = (key: string, alt: string) => ReactNode;

export interface LandingCause {
	id?: string;
	name: string;
	slug: string;
	icon: string | null;
}

export interface LandingOpportunity {
	id: string;
	kind: "event" | "need" | "story" | "post";
	title: string;
	description: string;
	organization: string;
	verified: boolean;
	city: string | null;
	category?: string;
	categorySlug?: string;
	imageUrl?: string;
	imageKey?: string | null;
	imageAlt?: string;
	date?: string;
	fact?: string;
	href: string;
	action: string;
	demo?: boolean;
}

/** A public directory record, not an exact street address. */
export interface LandingOrganization {
	id: string;
	name: string;
	city: string;
	state: string | null;
	description: string | null;
	category?: string;
	verified: boolean;
	href: string;
	demo?: boolean;
}

export interface LandingData {
	causes: readonly LandingCause[];
	opportunities: LandingOpportunity[];
	opportunitiesState: DataState;
	organizations: LandingOrganization[];
	organizationsState: DataState;
	selectedCause: string | null;
	onSelectCause: (slug: string | null) => void;
	onRetry: () => void;
}
