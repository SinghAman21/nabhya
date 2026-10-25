import {
	PDFDocument,
	type PDFFont,
	type PDFPage,
	type RGB,
	rgb,
	StandardFonts,
} from "pdf-lib";
import qrcode from "qrcode-generator";

export interface CertificateContent {
	code: string;
	volunteerName: string;
	organizationName: string;
	eventTitle: string;
	eventDate: string;
	eventTimeRange: string;
	hoursText: string;
	issuedAt: string;
	note: string | null;
	verifyUrl: string;
}

// The brand, as print colours. Orange is the one accent and only ever a fill
// (the sun, one rule) - as text it is too light to read on white.
const ORANGE = rgb(1, 0.494, 0.251); // #FF7E40
const INK = rgb(0.086, 0.063, 0.051); // #16100D, the brand's warm near-black
const BODY = rgb(0.29, 0.27, 0.25);
const MUTED = rgb(0.47, 0.45, 0.43);
const RULE = rgb(0.9, 0.87, 0.84);
const WATERMARK = rgb(0.975, 0.96, 0.945);

/**
 * The drawn Nabhya wordmark and mark, copied from `apps/native/src/components/
 * logo.tsx` (between its brand-paths markers) - the server cannot import the
 * app. Change them together. Stroked at LOGO_STROKE in a viewBox of
 * width x height, with the sun filled.
 */
const LOGO_STROKE = 3.2;
const WORDMARK = {
	width: 95,
	height: 27,
	ink: "M1.6 6V20M1.6 12.25A4.8 4.8 0 0 1 11.2 12.25V20M16.9 13A5.55 5.55 0 1 1 28 13A5.55 5.55 0 1 1 16.9 13ZM28 6V20M34.3 0V20M34.3 13A5.55 5.55 0 1 1 45.4 13A5.55 5.55 0 1 1 34.3 13ZM51.1 0V20M51.1 12.25A4.8 4.8 0 0 1 60.7 12.25V20M67 6V13.75A4.8 4.8 0 0 0 76.6 13.75M76.6 6V21.6A3.4 3.4 0 0 1 73.2 25H71.6M82.3 13A5.55 5.55 0 1 1 93.4 13A5.55 5.55 0 1 1 82.3 13ZM93.4 6V20",
	sun: "M4.2 20A2.2 2.2 0 0 1 8.6 20Z",
} as const;
const MARK = {
	ink: "M3.2 1V15M3.2 7.25A4.8 4.8 0 0 1 12.8 7.25V15",
} as const;

/**
 * Renders the certificate as a landscape A4 PDF.
 *
 * Laid out like an editorial page, left-aligned on one grid: the brand, then
 * what this is, then *who* (the name is the largest thing on the page), then
 * what they did and the facts of it, and verification at the foot where a
 * reader looks for it. It replaced a centred stack of differently-styled lines
 * under an orange display headline and a placeholder "E-signature block" -
 * busy, and a placeholder reads as a forgery on a document meant to be shown.
 *
 * Standard PDF fonts only (Helvetica for the system, Times for the name), so
 * the file needs no embedded font and renders identically everywhere.
 */
export async function renderCertificatePdf(
	content: CertificateContent,
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	pdf.setTitle(`Certificate of volunteering - ${content.volunteerName}`);
	pdf.setAuthor(content.organizationName);
	pdf.setCreator("Nabhya");

	const page = pdf.addPage([842, 595]); // A4 landscape, points
	const { width, height } = page.getSize();

	const sans = await pdf.embedFont(StandardFonts.Helvetica);
	const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

	const left = 72;
	const contentWidth = width - left * 2;

	// Frame: one hairline inset from the edge, a quiet border that survives a
	// printer's margins.
	page.drawRectangle({
		x: 24,
		y: 24,
		width: width - 48,
		height: height - 48,
		borderColor: RULE,
		borderWidth: 1,
	});

	// Watermark: the brand's "n" arch, oversized and barely there, behind the
	// right half where no text runs.
	page.drawSvgPath(MARK.ink, {
		x: width - 300,
		y: height - 96,
		scale: 15,
		borderColor: WATERMARK,
		borderWidth: LOGO_STROKE,
	});

	// ── Header: wordmark left, certificate number right ──────────────────────
	const logoScale = 1.15;
	const logoTop = height - 62;
	page.drawSvgPath(WORDMARK.ink, {
		x: left,
		y: logoTop,
		scale: logoScale,
		borderColor: INK,
		borderWidth: LOGO_STROKE,
	});
	page.drawSvgPath(WORDMARK.sun, {
		x: left,
		y: logoTop,
		scale: logoScale,
		color: ORANGE,
	});
	rightText(
		page,
		`Certificate no. ${content.code}`,
		width - left,
		height - 76,
		9,
		sansBold,
		BODY,
	);

	// The middle block flows downward from the eyebrow; a two-line event
	// title plus a note can run it into the foot. Measure first, then lift the
	// whole block by the overlap - there is room under the header, none above
	// the foot.
	const footRuleY = 64 + 88;
	const titleLines = wrap(
		content.eventTitle,
		sansBold,
		22,
		contentWidth - 140,
		2,
	);
	const factsGap = 58;
	const lowestY =
		height -
		322 -
		(titleLines.length - 1) * 28 -
		factsGap -
		(content.note ? 40 : 17);
	const lift = Math.max(0, footRuleY + 18 - lowestY);
	const y = (base: number) => base + lift;

	// ── What this is, and who ────────────────────────────────────────────────
	spaced(
		page,
		"CERTIFICATE OF VOLUNTEERING",
		left,
		y(height - 152),
		10,
		sansBold,
		ORANGE_TEXT,
	);
	page.drawText("Presented to", {
		x: left,
		y: y(height - 184),
		size: 12,
		font: sans,
		color: MUTED,
	});

	const nameSize = fitSize(
		content.volunteerName,
		serifBold,
		46,
		28,
		contentWidth - 140,
	);
	const name = fit(
		content.volunteerName,
		serifBold,
		nameSize,
		contentWidth - 140,
	);
	page.drawText(name, {
		x: left,
		y: y(height - 236),
		size: nameSize,
		font: serifBold,
		color: INK,
	});
	// The single orange rule: under the name, short - an accent, not a line.
	page.drawRectangle({
		x: left,
		y: y(height - 256),
		width: 56,
		height: 3,
		color: ORANGE,
	});

	// ── What they did ────────────────────────────────────────────────────────
	page.drawText(
		`for giving their time with ${fit(content.organizationName, sans, 13, contentWidth - 200)} at`,
		{
			x: left,
			y: y(height - 290),
			size: 13,
			font: sans,
			color: BODY,
		},
	);
	titleLines.forEach((line, index) => {
		page.drawText(line, {
			x: left,
			y: y(height - 322 - index * 28),
			size: 22,
			font: sansBold,
			color: INK,
		});
	});

	// ── The facts, one row on a four-column grid ─────────────────────────────
	const factsTop = y(height - 322 - (titleLines.length - 1) * 28 - factsGap);
	const facts: Array<[string, string]> = [
		["DATE", content.eventDate],
		["TIME", content.eventTimeRange],
		["HOURS GIVEN", `${content.hoursText} hours`],
		["ORGANISED BY", content.organizationName],
	];
	const column = contentWidth / 4;
	facts.forEach(([label, value], index) => {
		const x = left + index * column;
		spaced(page, label, x, factsTop, 7.5, sansBold, MUTED);
		page.drawText(fit(value, sansBold, 11.5, column - 16), {
			x,
			y: factsTop - 17,
			size: 11.5,
			font: sansBold,
			color: INK,
		});
	});

	if (content.note) {
		page.drawText(fit(`"${content.note}"`, sans, 10.5, contentWidth), {
			x: left,
			y: factsTop - 40,
			size: 10.5,
			font: sans,
			color: BODY,
		});
	}

	// ── Foot: verification left, issuer right ────────────────────────────────
	const footY = 64;
	page.drawLine({
		start: { x: left, y: footRuleY },
		end: { x: width - left, y: footRuleY },
		color: RULE,
		thickness: 1,
	});

	// A printed certificate is checked by pointing a phone at it, not by
	// retyping a URL - so the QR leads, and the link and code back it up.
	const qrSize = 78;
	drawQr(page, content.verifyUrl, left, footY, qrSize);
	const qrText = left + qrSize + 14;
	page.drawText("Scan to verify", {
		x: qrText,
		y: footY + 52,
		size: 10.5,
		font: sansBold,
		color: INK,
	});
	page.drawText(fit(content.verifyUrl, sans, 8.5, 300), {
		x: qrText,
		y: footY + 36,
		size: 8.5,
		font: sans,
		color: MUTED,
	});
	page.drawText("Anyone can check it - no account needed.", {
		x: qrText,
		y: footY + 6,
		size: 8.5,
		font: sans,
		color: MUTED,
	});

	const issuer = fit(content.organizationName, sansBold, 12, 260);
	rightText(page, issuer, width - left, footY + 50, 12, sansBold, INK);
	rightText(
		page,
		`Issued on ${content.issuedAt} through Nabhya`,
		width - left,
		footY + 33,
		9,
		sans,
		MUTED,
	);
	rightText(
		page,
		"Verified NGO on Nabhya",
		width - left,
		footY + 6,
		8.5,
		sans,
		MUTED,
	);

	return pdf.save();
}

/**
 * Orange as *text* is 2.53:1 on white - unreadable for body copy, but the
 * eyebrow is 10pt bold capitals, a label rather than reading text. A deeper
 * shade of the brand keeps it legible in print.
 */
const ORANGE_TEXT = rgb(0.85, 0.36, 0.13);

/** Capitals with letter-spacing, which pdf-lib's drawText cannot do itself. */
function spaced(
	page: PDFPage,
	text: string,
	x: number,
	y: number,
	size: number,
	font: PDFFont,
	color: RGB,
	tracking = size * 0.14,
) {
	let cursor = x;
	for (const char of text) {
		page.drawText(char, { x: cursor, y, size, font, color });
		cursor += font.widthOfTextAtSize(char, size) + tracking;
	}
}

function rightText(
	page: PDFPage,
	text: string,
	right: number,
	y: number,
	size: number,
	font: PDFFont,
	color: RGB,
) {
	page.drawText(text, {
		x: right - font.widthOfTextAtSize(text, size),
		y,
		size,
		font,
		color,
	});
}

/** The largest size from `max` down to `min` at which `text` fits `width`. */
function fitSize(
	text: string,
	font: PDFFont,
	max: number,
	min: number,
	width: number,
): number {
	for (let size = max; size > min; size -= 1) {
		if (font.widthOfTextAtSize(text, size) <= width) return size;
	}
	return min;
}

/** `text` cut with an ellipsis so it fits `width` at `size`. */
function fit(text: string, font: PDFFont, size: number, width: number): string {
	if (font.widthOfTextAtSize(text, size) <= width) return text;
	let cut = text;
	while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > width) {
		cut = cut.slice(0, -1);
	}
	return `${cut.trimEnd()}…`;
}

/** Word-wraps into at most `maxLines`, ellipsising the last. */
function wrap(
	text: string,
	font: PDFFont,
	size: number,
	width: number,
	maxLines: number,
): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let line = "";
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (font.widthOfTextAtSize(next, size) <= width) {
			line = next;
			continue;
		}
		if (line) lines.push(line);
		line = word;
		if (lines.length === maxLines) break;
	}
	if (lines.length < maxLines && line) lines.push(line);
	if (lines.length > maxLines) lines.length = maxLines;
	const consumed = lines.join(" ").length;
	if (consumed < text.trim().length) {
		const last = lines.length - 1;
		lines[last] = fit(`${lines[last]} …`, font, size, width);
	}
	return lines;
}

/**
 * Draws `text` as a QR code with its bottom-left corner at (x, y), `size`
 * points square, on a white quiet zone. Error correction "M" survives a
 * smudged print; one rectangle per dark module keeps it vector-sharp.
 */
function drawQr(
	page: PDFPage,
	text: string,
	x: number,
	y: number,
	size: number,
) {
	const qr = qrcode(0, "M");
	qr.addData(text);
	qr.make();
	const count = qr.getModuleCount();
	const quiet = 2;
	const cell = size / (count + quiet * 2);
	page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (!qr.isDark(row, col)) continue;
			page.drawRectangle({
				x: x + (col + quiet) * cell,
				// PDF y grows upward; QR rows run top to bottom.
				y: y + size - (row + quiet + 1) * cell,
				// A hair over the cell, so viewers that anti-alias each
				// rectangle on its own don't draw seams between modules.
				width: cell + 0.05,
				height: cell + 0.05,
				color: INK,
			});
		}
	}
}
