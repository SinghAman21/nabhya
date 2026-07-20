import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface CertificateContent {
	code: string;
	volunteerName: string;
	organizationName: string;
	eventTitle: string;
	eventDate: string;
	issuedAt: string;
	note: string | null;
	verifyUrl: string;
}

const BRAND = rgb(1, 0.494, 0.251); // #FF7E40
const INK = rgb(0.067, 0.067, 0.067);
const MUTED = rgb(0.4, 0.4, 0.4);

/**
 * Renders the certificate as a landscape A4 PDF.
 *
 * Deliberately plain: no images or embedded fonts, so generation has no
 * external dependencies and cannot fail on a missing asset. The verification
 * code and URL are the parts that carry weight — the document itself is a
 * readable wrapper around a claim anyone can check.
 */
export async function renderCertificatePdf(
	content: CertificateContent,
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([842, 595]); // A4 landscape, points
	const { width, height } = page.getSize();

	const serif = await pdf.embedFont(StandardFonts.TimesRoman);
	const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
	const sans = await pdf.embedFont(StandardFonts.Helvetica);

	// Border
	page.drawRectangle({
		x: 28,
		y: 28,
		width: width - 56,
		height: height - 56,
		borderColor: BRAND,
		borderWidth: 2,
	});

	const centre = (
		text: string,
		y: number,
		size: number,
		font = serif,
		color = INK,
	) => {
		const textWidth = font.widthOfTextAtSize(text, size);
		page.drawText(text, {
			x: (width - textWidth) / 2,
			y,
			size,
			font,
			color,
		});
	};

	centre("CERTIFICATE OF VOLUNTEERING", height - 110, 26, serifBold, BRAND);
	centre("This is to certify that", height - 165, 13, serif, MUTED);
	centre(truncate(content.volunteerName, 46), height - 215, 32, serifBold);

	centre("volunteered with", height - 255, 13, serif, MUTED);
	centre(truncate(content.organizationName, 52), height - 295, 20, serifBold);

	centre(`at "${truncate(content.eventTitle, 56)}"`, height - 330, 15);
	centre(`on ${content.eventDate}`, height - 358, 13, serif, MUTED);

	if (content.note) {
		centre(truncate(content.note, 90), height - 392, 11, serif, MUTED);
	}

	// Footer: issue date left, verification right.
	page.drawText(`Issued ${content.issuedAt}`, {
		x: 60,
		y: 78,
		size: 9,
		font: sans,
		color: MUTED,
	});

	page.drawText(`Verify at ${content.verifyUrl}`, {
		x: 60,
		y: 62,
		size: 9,
		font: sans,
		color: MUTED,
	});

	const codeLabel = `Certificate ID: ${content.code}`;
	page.drawText(codeLabel, {
		x: width - 60 - sans.widthOfTextAtSize(codeLabel, 10),
		y: 78,
		size: 10,
		font: sans,
		color: INK,
	});

	return pdf.save();
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
