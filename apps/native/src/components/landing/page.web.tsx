import type { CSSProperties, ReactNode } from "react";
import { landingColors } from "@/constants/design-system";
import { FinalCta } from "./final-cta.web";
import { Footer } from "./footer.web";
import { Header } from "./header.web";
import { LandingHero } from "./hero.web";
import { IndiaMap } from "./india-map.web";
import { OpportunityShowcase } from "./opportunity-showcase.web";
import { TrustSection } from "./trust.web";
import type { LandingData, StoredImageRenderer } from "./types";
import "./landing.css";

const LANDING_STYLE = Object.fromEntries(
	Object.entries(landingColors).map(([name, value]) => [
		`--landing-${name}`,
		value,
	]),
) as CSSProperties;
interface PageProps extends LandingData {
	logo: ReactNode;
	renderStoredImage?: StoredImageRenderer;
}

export function LandingPageView({
	logo,
	renderStoredImage,
	...data
}: PageProps) {
	return (
		<div className="nabhya-landing" style={LANDING_STYLE}>
			<a className="landing-skip" href="#main-content">
				Skip to content
			</a>
			<Header logo={logo} />
			<main id="main-content" tabIndex={-1}>
				<LandingHero />
				<OpportunityShowcase
					data={data}
					renderStoredImage={renderStoredImage}
				/>
				<IndiaMap
					organizations={data.organizations}
					state={data.organizationsState}
					onRetry={data.onRetry}
				/>
				<TrustSection />
				<FinalCta />
			</main>
			<Footer logo={logo} />
		</div>
	);
}
