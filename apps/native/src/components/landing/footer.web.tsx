import type { ReactNode } from "react";
import { Icon } from "./icons.web";
export function Footer({ logo }: { logo: ReactNode }) {
	return (
		<footer className="landing-footer">
			<div className="landing-container">
				<div className="footer-main">
					<div className="footer-brand">
						<a href="/" className="landing-brand" aria-label="Nabhya home">
							{logo}
						</a>
						<p>People who care. Places to help.</p>
					</div>
					<nav aria-label="Explore">
						<p>Explore</p>
						<a href="/events">Volunteer events</a>
						<a href="/ngos">NGO directory</a>
						<a href="#causes">Causes</a>
						<a href="#across-india">Across India</a>
					</nav>
					<nav aria-label="Get involved">
						<p>Get involved</p>
						<a href="/signup">Join as a volunteer</a>
						<a href="/signup">Register your NGO</a>
						<a href="/login">Sign in</a>
					</nav>
					<nav aria-label="About Nabhya">
						<p>About Nabhya</p>
						<a href="#how-it-works">How it works</a>
						<a href="#trust">Trust & accountability</a>
						<a href="/certificates">Volunteer certificates</a>
					</nav>
				</div>
				<div className="footer-bottom">
					<p>© {new Date().getFullYear()} Nabhya. Made for people who care.</p>
					<details className="landing-credits">
						<summary>
							Type & map credits <Icon name="ChevronDown" size={13} />
						</summary>
						<p>
							Map data:{" "}
							<a
								href="https://www.naturalearthdata.com/about/"
								target="_blank"
								rel="noreferrer"
							>
								Natural Earth
							</a>
							, public domain. Newsreader typeface under the SIL Open Font
							License.
						</p>
					</details>
				</div>
			</div>
		</footer>
	);
}
