import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

const BRAND = rgb(1, 0.494, 0.251); // #FF7E40
const INK = rgb(0.067, 0.067, 0.067);
const MUTED = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.94, 0.94, 0.94);

/**
 * Renders the certificate as a landscape A4 PDF.
 *
 * The document is intentionally self-contained: it reads well on its own,
 * carries the public verification code, and can be recreated from the database
 * if the stored PDF is ever lost.
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
	const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

	const left = 56;
	const right = width - 56;

	// Border and header band.
	page.drawRectangle({
		x: 28,
		y: 28,
		width: width - 56,
		height: height - 56,
		borderColor: BRAND,
		borderWidth: 2,
	});
	page.drawRectangle({
		x: 30,
		y: height - 112,
		width: width - 60,
		height: 68,
		color: LIGHT,
	});
	page.drawLine({
		start: { x: 30, y: height - 112 },
		end: { x: width - 30, y: height - 112 },
		color: BRAND,
		thickness: 1.5,
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

	const rightAlign = (
		text: string,
		y: number,
		size: number,
		font = sans,
		color = INK,
	) => {
		page.drawText(text, {
			x: right - font.widthOfTextAtSize(text, size),
			y,
			size,
			font,
			color,
		});
	};

	page.drawText("NABHYA", {
		x: left,
		y: height - 72,
		size: 18,
		font: sansBold,
		color: BRAND,
	});
	page.drawText("NGO VOLUNTEER PLATFORM", {
		x: left,
		y: height - 88,
		size: 8,
		font: sans,
		color: MUTED,
	});
	page.drawText(truncate(content.organizationName, 34), {
		x:
			right -
			sansBold.widthOfTextAtSize(truncate(content.organizationName, 34), 11),
		y: height - 70,
		size: 11,
		font: sansBold,
		color: INK,
	});
	rightAlign(`Issued ${content.issuedAt}`, height - 87, 9, sans, MUTED);

	centre("CERTIFICATE OF VOLUNTEERING", height - 168, 28, serifBold, BRAND);
	centre("This is to certify that", height - 212, 13, serif, MUTED);
	centre(truncate(content.volunteerName, 46), height - 264, 34, serifBold);

	const volunteerWidth = serifBold.widthOfTextAtSize(
		truncate(content.volunteerName, 46),
		34,
	);
	page.drawLine({
		start: { x: (width - volunteerWidth) / 2, y: height - 269 },
		end: { x: (width + volunteerWidth) / 2, y: height - 269 },
		color: BRAND,
		thickness: 1,
	});

	centre("has participated in", height - 304, 13, serif, MUTED);
	centre(truncate(content.eventTitle, 58), height - 348, 21, serifBold);
	centre(
		`held on ${content.eventDate} from ${content.eventTimeRange}`,
		height - 378,
		12,
		italic,
		MUTED,
	);
	centre(
		`and contributed ${content.hoursText} hours of service.`,
		height - 408,
		14,
		serif,
		INK,
	);

	if (content.note) {
		centre(
			`Note: ${truncate(content.note, 84)}`,
			height - 440,
			10,
			sans,
			MUTED,
		);
	}

	// Bottom-left verification details.
	page.drawText(`Verify: ${content.verifyUrl}`, {
		x: left,
		y: 72,
		size: 9,
		font: sans,
		color: MUTED,
	});
	page.drawText(`Certificate ID: ${content.code}`, {
		x: left,
		y: 56,
		size: 9,
		font: sans,
		color: INK,
	});

	// Bottom-right digital issuance block.
	const signatureX = width - 300;
	page.drawLine({
		start: { x: signatureX, y: 120 },
		end: { x: width - 56, y: 120 },
		color: BRAND,
		thickness: 1,
	});
	page.drawText("Digitally issued by Nabhya", {
		x: signatureX,
		y: 104,
		size: 9,
		font: sans,
		color: MUTED,
	});
	page.drawText("E-signature block", {
		x: signatureX,
		y: 88,
		size: 12,
		font: serifBold,
		color: INK,
	});
	page.drawText("Verified from the certificate database", {
		x: signatureX,
		y: 70,
		size: 9,
		font: sans,
		color: MUTED,
	});

	return pdf.save();
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
