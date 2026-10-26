import { Cta } from "./controls.web";
export function FinalCta() {
	return (
		<section className="landing-final" aria-labelledby="final-heading">
			<div className="landing-container final-inner">
				<div>
					<p className="landing-eyebrow">READY TO SHOW UP?</p>
					<h2 id="final-heading">
						Your next small act
						<br />
						<em>starts here.</em>
					</h2>
				</div>
				<div className="final-actions">
					<Cta href="/events">Explore opportunities</Cta>
					<a className="landing-text-link" href="/signup">
						Register your NGO <span aria-hidden="true">↗</span>
					</a>
				</div>
			</div>
		</section>
	);
}
