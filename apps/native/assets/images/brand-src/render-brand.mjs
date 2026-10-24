// Renders every raster brand asset from the vector paths in
// src/components/logo.tsx (between the `brand-paths` markers), so the icons,
// favicon, splash and OG card can never drift from the in-app logo.
//
// Not an app dependency on purpose. Run from any scratch folder:
//   npm i @resvg/resvg-js@2.6.2
//   node <repo>/apps/native/assets/images/brand-src/render-brand.mjs
// (NODE_PATH or a local node_modules must resolve @resvg/resvg-js.)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(process.cwd(), "noop.js"));
const { Resvg } = require("@resvg/resvg-js");

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "../../..");
const images = join(app, "assets/images");
const pub = join(app, "public");
const fonts = join(app, "assets/fonts");

// --- read the paths out of logo.tsx -------------------------------------
const src = readFileSync(join(app, "src/components/logo.tsx"), "utf8");
const block = src.split("brand-paths:start")[1].split("brand-paths:end")[0];
const STROKE = Number(block.match(/LOGO_STROKE = ([\d.]+)/)[1]);
const pick = (name) => {
	const body = block
		.split(`export const ${name} = {`)[1]
		.split("} as const")[0];
	const get = (k) => body.match(new RegExp(`${k}: "?([^",\\n]+)"?,`))[1];
	return {
		width: Number(get("width")),
		height: Number(get("height")),
		ink: get("ink"),
		sun: get("sun"),
	};
};
const WORDMARK = pick("WORDMARK");
const MARK = pick("MARK");

// --- palette (design-system.ts) ------------------------------------------
const ORANGE = "#FF7E40";
const GROUND = "#1F1712"; // brand.surface
const DEEP = "#16100D";
const CREAM = "#FFF6EF";

// The mark's drawn glyph is x 1.6..14.4, y 1..15 of its 16 box; centre on that.
const glyph = (cx, cy, h, ink, sun) => {
	const s = h / 14;
	return `<g transform="translate(${cx - 8 * s} ${cy - 8 * s}) scale(${s})"><path d="${MARK.ink}" fill="none" stroke="${ink}" stroke-width="${STROKE}"/>${sun ? `<path d="${MARK.sun}" fill="${sun}"/>` : ""}</g>`;
};
const wordmark = (x, y, h, ink, sun) => {
	const s = h / WORDMARK.height;
	return `<g transform="translate(${x} ${y}) scale(${s})"><path d="${WORDMARK.ink}" fill="none" stroke="${ink}" stroke-width="${STROKE}"/><path d="${WORDMARK.sun}" fill="${sun}"/></g>`;
};
const svg = (w, h, body) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

function png(file, markup, fontFiles) {
	const r = new Resvg(markup, {
		font: fontFiles
			? { fontFiles, loadSystemFonts: false, defaultFontFamily: "Mona Sans" }
			: { loadSystemFonts: false },
	});
	writeFileSync(file, r.render().asPng());
	console.log("wrote", file);
}

mkdirSync(pub, { recursive: true });

// App icon: full-bleed square (iOS and the stores mask it), glyph ~44% tall.
png(
	join(images, "icon.png"),
	svg(
		1024,
		1024,
		`<rect width="1024" height="1024" fill="${GROUND}"/>${glyph(512, 512, 450, CREAM, ORANGE)}`,
	),
);
// Android adaptive: the launcher crops to a circle/squircle inside the
// middle 66%, so the glyph stays well inside it.
png(
	join(images, "android-icon-foreground.png"),
	svg(1024, 1024, glyph(512, 512, 330, CREAM, ORANGE)),
);
png(
	join(images, "android-icon-background.png"),
	svg(1024, 1024, `<rect width="1024" height="1024" fill="${GROUND}"/>`),
);
// Themed icons tint this one colour; the sun stays as a shape.
png(
	join(images, "android-icon-monochrome.png"),
	svg(1024, 1024, glyph(512, 512, 330, "#FFFFFF", "#FFFFFF")),
);
// Splash: the mark alone, on the light and dark app grounds (see app.json).
png(
	join(images, "splash-icon.png"),
	svg(512, 512, glyph(256, 256, 448, DEEP, ORANGE)),
);
png(
	join(images, "splash-icon-dark.png"),
	svg(512, 512, glyph(256, 256, 448, CREAM, ORANGE)),
);

// Favicons: a rounded tile, because a bare n disappears on a dark tab strip.
const tile = (n) =>
	svg(
		n,
		n,
		`<rect width="${n}" height="${n}" rx="${n * 0.22}" fill="${DEEP}"/>${glyph(n / 2, n / 2, n * 0.58, CREAM, ORANGE)}`,
	);
png(join(images, "favicon.png"), tile(48));
png(join(pub, "favicon-32.png"), tile(32));
png(
	join(pub, "apple-touch-icon.png"),
	svg(
		180,
		180,
		`<rect width="180" height="180" fill="${GROUND}"/>${glyph(90, 90, 80, CREAM, ORANGE)}`,
	),
);

// OG card, 1200x630: dark warm ground, a faint oversized arch bleeding off
// the right edge, the wordmark, one line and one sub-line.
const og = svg(
	1200,
	630,
	`<rect width="1200" height="630" fill="${DEEP}"/>
	<g transform="translate(800 70) scale(36)"><path d="${MARK.ink}" fill="none" stroke="#241A15" stroke-width="${STROKE}"/><path d="${MARK.sun}" fill="#33201A"/></g>
	${wordmark(88, 92, 54, "#FFFFFF", ORANGE)}
	<text x="86" y="430" font-family="Mona Sans" font-weight="700" font-size="76" letter-spacing="-1.5" fill="#FFFFFF">Help that shows up.</text>
	<text x="88" y="492" font-family="Mona Sans" font-weight="400" font-size="30" fill="#A3A3A3">Verified NGOs and volunteers, across India.</text>
	<rect x="88" y="540" width="40" height="4" rx="2" fill="${ORANGE}"/>`,
);
png(join(pub, "og-image.png"), og, [
	join(fonts, "MonaSans-Bold.otf"),
	join(fonts, "MonaSans-Regular.otf"),
]);
