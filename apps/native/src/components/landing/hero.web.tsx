import { Cta } from "./controls.web";
import { WorkflowStory } from "./workflow-story.web";

export function LandingHero() {
	return (
		<section
			className="landing-hero landing-container"
			aria-labelledby="hero-heading"
		>
			<div className="hero-copy">
				<p className="landing-eyebrow">
					<span /> GOOD PEOPLE. A LITTLE TIME.
				</p>
				<h1 id="hero-heading">
					Volunteering,
					<br />
					without the
					<br />
					<em>back-and-forth.</em>
				</h1>
				<p className="hero-description">
					One place to discover opportunities, apply, and hear back from the
					NGO.
				</p>
				<div className="hero-actions">
					<Cta href="/events">Explore opportunities</Cta>
					<a className="landing-text-link" href="/signup">
						Register your NGO <span aria-hidden="true">↗</span>
					</a>
				</div>
				<p className="hero-journey">
					<span>Find your thing</span>
					<span aria-hidden="true">→</span>
					<span>Hear back</span>
					<span aria-hidden="true">→</span>
					<span>Show up</span>
				</p>
			</div>
			<WorkflowStory />
		</section>
	);
}
