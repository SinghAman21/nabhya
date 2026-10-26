import { CauseDiscovery } from "./cause-discovery.web";
import { Icon } from "./icons.web";
import { OpportunityCard, OpportunitySkeleton } from "./opportunity-card.web";
import type { LandingData, StoredImageRenderer } from "./types";

export function OpportunityShowcase({
	data,
	renderStoredImage,
}: {
	data: LandingData;
	renderStoredImage?: StoredImageRenderer;
}) {
	const items = data.opportunities.slice(0, 3);
	const selected = data.causes.find((c) => c.slug === data.selectedCause);
	return (
		<section
			id="opportunities"
			className="landing-section opportunities-section"
			aria-labelledby="opportunities-heading"
		>
			<div className="landing-container">
				<div className="landing-section-heading">
					<div>
						<p className="landing-eyebrow">FIND YOUR WAY TO LEND A HAND</p>
						<h2 id="opportunities-heading">
							Something you care about.
							<br />
							<em>Somewhere to show up.</em>
						</h2>
					</div>
					<a className="landing-text-link" href="/events">
						Explore all events <Icon name="ArrowUpRight" size={18} />
					</a>
				</div>
				<CauseDiscovery
					causes={data.causes}
					selected={data.selectedCause}
					onSelect={data.onSelectCause}
				/>
				{items.some((item) => item.demo) ? (
					<p className="listing-source-note">
						Development sample listings · open a listing to explore the event
						flow.
					</p>
				) : null}
				<div
					className="opportunity-grid"
					aria-busy={data.opportunitiesState === "loading"}
				>
					{data.opportunitiesState === "loading" ? (
						<>
							<span className="landing-sr-only" role="status">
								Finding volunteer opportunities
							</span>
							<OpportunitySkeleton />
							<OpportunitySkeleton />
							<OpportunitySkeleton />
						</>
					) : (
						items.map((item) => (
							<OpportunityCard
								key={item.id}
								item={item}
								renderStoredImage={renderStoredImage}
							/>
						))
					)}
				</div>
				{data.opportunitiesState !== "loading" && !items.length ? (
					<div className="opportunity-empty" role="status">
						<Icon name="Calendar" size={28} />
						<h3>
							{data.opportunitiesState === "unavailable"
								? "Couldn't load opportunities."
								: "Your next opportunity is on its way."}
						</h3>
						<p>
							{data.opportunitiesState === "unavailable"
								? "Try again, or explore the NGO directory."
								: selected
									? `No published events for ${selected.name.toLowerCase()} in this selection yet.`
									: "Explore NGOs and follow the work you care about."}
						</p>
						<div>
							{data.opportunitiesState === "unavailable" ? (
								<button
									type="button"
									className="landing-text-link"
									onClick={data.onRetry}
								>
									Try again <Icon name="ArrowRight" size={16} />
								</button>
							) : null}
							<a href="/ngos" className="landing-text-link">
								Explore NGOs <Icon name="ArrowUpRight" size={16} />
							</a>
						</div>
					</div>
				) : null}
			</div>
		</section>
	);
}
