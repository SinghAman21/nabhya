import { useMemo, useState } from "react";
import { cityCoordinates, normaliseCityName } from "@/lib/cities";
import { Icon } from "./icons.web";
import { INDIA_OUTLINE, INDIA_PROJECTION } from "./india-geometry";
import type { DataState, LandingOrganization } from "./types";

interface LocationGroup {
	id: string;
	x: number;
	y: number;
	cities: string[];
	organizations: LandingOrganization[];
}

/** Uses the same Mercator transform as the licensed, precomputed outline. */
function project(latitude: number, longitude: number) {
	const p = INDIA_PROJECTION;
	return {
		x: p.left + ((longitude * Math.PI) / 180 - p.minX) * p.scale,
		y:
			p.top +
			(p.maxY - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))) *
				p.scale,
	};
}

function groupLocations(organizations: LandingOrganization[]): LocationGroup[] {
	const cities = new Map<string, LocationGroup>();
	for (const org of organizations) {
		const city = normaliseCityName(org.city);
		const point = cityCoordinates(city);
		if (!point) continue;
		const existing = cities.get(city);
		if (existing) existing.organizations.push(org);
		else
			cities.set(city, {
				id: city,
				cities: [city],
				organizations: [org],
				...project(point.latitude, point.longitude),
			});
	}
	// Merge close city centres at the smallest map size. The complete city list
	// remains in the preview; no precision or coverage is inferred from a cluster.
	const clusters: LocationGroup[] = [];
	for (const city of cities.values()) {
		const cluster = clusters.find(
			(group) => Math.hypot(city.x - group.x, city.y - group.y) < 88,
		);
		if (cluster) {
			cluster.cities.push(...city.cities);
			cluster.organizations.push(...city.organizations);
		} else
			clusters.push({
				...city,
				cities: [...city.cities],
				organizations: [...city.organizations],
			});
	}
	return clusters;
}

export function IndiaMap({
	organizations,
	state,
	onRetry,
}: {
	organizations: LandingOrganization[];
	state: DataState;
	onRetry: () => void;
}) {
	const [selection, setSelection] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const eligible = useMemo(
		() => organizations.filter((org) => org.verified && !org.demo),
		[organizations],
	);
	const groups = useMemo(() => groupLocations(eligible), [eligible]);
	const filtered = groups.filter((group) =>
		group.organizations.some((org) =>
			`${org.city} ${org.state ?? ""} ${org.name}`
				.toLowerCase()
				.includes(search.trim().toLowerCase()),
		),
	);
	const selected =
		filtered.find((group) => group.id === selection) ?? filtered[0];
	return (
		<section
			id="across-india"
			className="landing-section landing-network"
			aria-labelledby="network-heading"
		>
			<div className="landing-container network-layout">
				<div className="network-intro">
					<p className="landing-eyebrow">
						A SHARED PURPOSE. A LOCAL CONNECTION.
					</p>
					<h2 id="network-heading">
						Find your place
						<br />
						<em>to begin.</em>
					</h2>
					<p className="network-subtitle">
						Explore NGOs by city. See the work behind the pin.
					</p>
					<label className="location-search">
						<Icon name="Search" size={18} />
						<span className="landing-sr-only">Search NGO cities or states</span>
						<input
							type="search"
							placeholder="Find a city or state"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
					<section className="location-list" aria-label="NGO locations">
						{filtered.map((group) => (
							<button
								type="button"
								key={group.id}
								className={`location-row ${selected?.id === group.id ? "is-selected" : ""}`}
								aria-pressed={selected?.id === group.id}
								onClick={() => setSelection(group.id)}
							>
								<Icon name="MapPin" size={16} />
								<span>{group.cities.join(" / ")}</span>
								<Icon name="ArrowRight" size={16} />
							</button>
						))}
					</section>
					{!filtered.length ? (
						<p className="location-empty" role="status">
							{state === "loading"
								? "Finding NGO locations…"
								: state === "unavailable"
									? "Locations couldn't be loaded. Try again or browse the directory."
									: search
										? "No city matches this search."
										: "NGO locations will appear here when available."}
						</p>
					) : null}
					{selected ? (
						<div className="location-preview" aria-live="polite">
							<p className="landing-eyebrow">FROM THE DIRECTORY</p>
							<div className="location-preview-list">
								{selected.organizations.map((org) => (
									<a href={org.href} className="location-org" key={org.id}>
										<span className="organization-initial">
											{org.name.charAt(0)}
										</span>
										<span>
											<strong>{org.name}</strong>
											<small>
												{org.city}
												{org.category ? ` · ${org.category}` : ""}
											</small>
										</span>
										<Icon name="ArrowUpRight" size={16} />
									</a>
								))}
							</div>
							<div className="location-city-links">
								{selected.cities.map((city) => (
									<a href={`/ngos?city=${encodeURIComponent(city)}`} key={city}>
										NGOs in {city} <Icon name="ArrowRight" size={14} />
									</a>
								))}
							</div>
						</div>
					) : null}
					<div className="network-actions">
						<a className="landing-text-link" href="/ngos">
							Explore all NGOs <Icon name="ArrowUpRight" size={17} />
						</a>
						{state === "unavailable" ? (
							<button
								type="button"
								className="landing-text-link"
								onClick={onRetry}
							>
								Try again
							</button>
						) : null}
					</div>
				</div>
				<div className="network-cartography">
					<div className="network-map">
						<svg
							viewBox="0 0 600 620"
							className="network-outline"
							role="img"
							aria-label="Map of India. NGO locations are also available in the city list."
						>
							<defs>
								<pattern
									id="india-map-dots"
									width="8"
									height="8"
									patternUnits="userSpaceOnUse"
								>
									<circle cx="2" cy="2" r=".65" fill="currentColor" />
								</pattern>
							</defs>
							<path d={INDIA_OUTLINE} className="map-land" />
							<path
								d={INDIA_OUTLINE}
								fill="url(#india-map-dots)"
								className="map-texture"
							/>
							{selected
								? filtered
										.filter((group) => group.id !== selected.id)
										.map((group) => (
											<path
												key={group.id}
												d={`M${selected.x},${selected.y} Q${(group.x + selected.x) / 2},${Math.min(selected.y, group.y) - 50} ${group.x},${group.y}`}
												className="map-connection"
											/>
										))
								: null}
						</svg>
						{filtered.map((group) => (
							<button
								type="button"
								key={group.id}
								className={`map-marker ${selected?.id === group.id ? "is-selected" : ""}`}
								style={{ left: `${group.x / 6}%`, top: `${group.y / 6.2}%` }}
								aria-label={`Show NGOs in ${group.cities.join(" and ")}`}
								aria-pressed={selected?.id === group.id}
								onClick={() => setSelection(group.id)}
							>
								<span className="map-marker-dot" />
								<span
									className={`map-marker-label ${group.x > 370 ? "label-left" : ""}`}
								>
									{group.cities[0]}
									{group.cities.length > 1
										? ` +${group.cities.length - 1}`
										: ""}
								</span>
							</button>
						))}
					</div>
					<p className="map-caption">Directory locations · city-centre pins</p>
					<details className="map-credits">
						<summary>
							About this map <Icon name="ChevronDown" size={12} />
						</summary>
						<p>
							Locations come from the current NGO directory preview. Connecting
							lines are illustrative, not recorded partnerships.{" "}
							<a
								href="https://www.naturalearthdata.com/about/"
								target="_blank"
								rel="noreferrer"
							>
								Natural Earth
							</a>{" "}
							geography, de facto boundaries.
						</p>
					</details>
				</div>
			</div>
		</section>
	);
}
