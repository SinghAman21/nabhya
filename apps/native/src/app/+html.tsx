import {
	ScrollViewStyleReset,
	useServerDocumentContext,
} from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * The web document shell for the static build (`web.output: "static"`).
 * Runs only in Node at export time - no DOM, no app state, no global CSS
 * (that is imported by the root layout).
 *
 * It keeps Expo's default head exactly - charset, the viewport,
 * `ScrollViewStyleReset`, and `headNodes` / `bodyNodes`, which carry the
 * per-route title and the bundles - and adds the share card and theme colour.
 * The `<title>` is left to `headNodes` (`lib/document-title.ts`).
 *
 * Social crawlers need an absolute `og:image`. Set `EXPO_PUBLIC_SITE_URL`
 * (e.g. https://nabhya.in) for a deployed build; without it the tags fall
 * back to root-relative paths, which browsers resolve but most crawlers do not.
 * The images live in `public/` and are produced by
 * `assets/images/brand-src/render-brand.mjs`.
 */
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
const TITLE = "Nabhya - Help that shows up";
const DESCRIPTION =
	"Verified NGOs and volunteers across India. Find a need you can meet or an event to turn up to, and get a certificate anyone can check.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Paints the app ground before the bundle runs, so dark mode has no white flash. */
const GROUND =
	"body{background-color:#FBFBF9}@media (prefers-color-scheme: dark){body{background-color:#0E0E0E}}";

export default function Root({ children }: PropsWithChildren) {
	const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } =
		useServerDocumentContext();

	return (
		<html lang="en" {...htmlAttributes}>
			<head>
				<meta charSet="utf-8" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, shrink-to-fit=no"
				/>
				<meta name="description" content={DESCRIPTION} />
				<meta
					name="theme-color"
					content="#FBFBF9"
					media="(prefers-color-scheme: light)"
				/>
				<meta
					name="theme-color"
					content="#0E0E0E"
					media="(prefers-color-scheme: dark)"
				/>
				<meta name="application-name" content="Nabhya" />
				<meta name="apple-mobile-web-app-title" content="Nabhya" />

				<meta property="og:type" content="website" />
				<meta property="og:site_name" content="Nabhya" />
				<meta property="og:title" content={TITLE} />
				<meta property="og:description" content={DESCRIPTION} />
				<meta property="og:image" content={OG_IMAGE} />
				<meta property="og:image:width" content="1200" />
				<meta property="og:image:height" content="630" />
				<meta
					property="og:image:alt"
					content="The nabhya wordmark above the line: Help that shows up."
				/>
				{SITE_URL ? <meta property="og:url" content={SITE_URL} /> : null}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={TITLE} />
				<meta name="twitter:description" content={DESCRIPTION} />
				<meta name="twitter:image" content={OG_IMAGE} />

				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32.png"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>

				<ScrollViewStyleReset />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, author-written CSS */}
				<style dangerouslySetInnerHTML={{ __html: GROUND }} />
				{headNodes}
			</head>
			<body {...bodyAttributes}>
				{children}
				{bodyNodes}
			</body>
		</html>
	);
}
