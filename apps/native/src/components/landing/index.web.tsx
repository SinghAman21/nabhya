import { useState } from "react";
import { Logo } from "@/components/logo";
import { landingColors } from "@/constants/design-system";
import { useStoredImageUrl } from "@/hooks/use-stored-image";
import { Botanical } from "./icons.web";
import { LandingPageView } from "./page.web";
import { useLandingData } from "./use-landing-data";

/** Stored covers use the app's signed-URL cache, never raw private object keys. */
function StoredCover({ imageKey, alt }: { imageKey: string; alt: string }) {
	const url = useStoredImageUrl(imageKey);
	const [failed, setFailed] = useState<string | null>(null);
	return url && failed !== url ? (
		<img
			src={url}
			alt={alt}
			width="800"
			height="480"
			loading="lazy"
			decoding="async"
			onError={() => setFailed(url)}
		/>
	) : (
		<div className="opportunity-art">
			<Botanical />
			<span>Good work. Real people.</span>
		</div>
	);
}

const renderStoredImage = (key: string, alt: string) => (
	<StoredCover imageKey={key} alt={alt} />
);

export default function PublicLandingPage() {
	const data = useLandingData();
	return (
		<LandingPageView
			{...data}
			logo={
				<Logo
					size={31}
					color={landingColors.heading}
					accent={landingColors.primary}
					label={null}
				/>
			}
			renderStoredImage={renderStoredImage}
		/>
	);
}
