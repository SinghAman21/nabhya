import { env } from "@nabhya/env/server";
import type { CreatePayoutProfileInput } from "@nabhya/shared";
import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common";

/** Shape of an organization row sufficient for Razorpay account creation. */
export interface OrgForOnboarding {
	organizationName: string;
	orgType: "TRUST" | "SOCIETY" | "SECTION_8" | "OTHERS" | null;
	registrationNumber: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	pincode: string | null;
}

/** Shape of a payout profile row sufficient for Razorpay calls. */
export interface PayoutProfileForOnboarding {
	legalEntityName: string;
	businessType: string;
	pan: string;
	bankAccountEncrypted: string;
	bankAccountLast4: string;
	ifsc: string;
	bankName: string | null;
	accountHolderName: string;
	signatoryName: string;
	signatoryEmail: string;
	signatoryPhone: string;
	signatoryDob: string | null;
	signatoryPan: string | null;
	signatoryAddress: string | null;
}

/**
 * Maps Nabhya's internal org type to the string Razorpay accepts in
 * `POST /v1/accounts` as `profile.type`.
 */
function toRazorpayEntityType(orgType: OrgForOnboarding["orgType"]): string {
	switch (orgType) {
		case "TRUST":
			return "trust";
		case "SOCIETY":
			return "society";
		case "SECTION_8":
			return "not_for_profit";
		case "OTHERS":
		default:
			return "not_for_profit";
	}
}

/**
 * Thin HTTP client around Razorpay Route's linked-account onboarding APIs.
 *
 * All four steps are separate methods so `PayoutsService` can:
 *   1. Call them sequentially and persist identifiers after each step.
 *   2. Resume a partially-completed onboarding from the step that failed.
 *
 * None of these methods write to the database — that is `PayoutsService`'s job.
 * Bank account numbers are decrypted by the caller and passed as plaintext only
 * in the `linkBankAccount` call; they are never logged.
 */
@Injectable()
export class RazorpayRouteService {
	private readonly logger = new Logger(RazorpayRouteService.name);

	private get credentials(): string {
		const keyId = env.RAZORPAY_KEY_ID;
		const keySecret = env.RAZORPAY_KEY_SECRET;
		if (!keyId || !keySecret) {
			throw new InternalServerErrorException(
				"Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
			);
		}
		return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
	}

	private async razorpayFetch<T>(
		path: string,
		options: RequestInit,
	): Promise<T> {
		const url = `https://api.razorpay.com${path}`;
		const res = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${this.credentials}`,
				...(options.headers ?? {}),
			},
		});

		if (!res.ok) {
			let details = "";
			try {
				const body = (await res.json()) as { error?: { description?: string } };
				details = body?.error?.description ?? "";
			} catch {
				// swallow JSON parse failure
			}
			this.logger.error(
				`Razorpay API error [${res.status}] ${path}: ${details}`,
			);
			throw new InternalServerErrorException(
				`Razorpay API call failed (${res.status})${details ? `: ${details}` : ""}`,
			);
		}

		return res.json() as Promise<T>;
	}

	/**
	 * Step 1 — Create a linked account for the NGO.
	 *
	 * Razorpay ref: `POST /v1/accounts`
	 */
	async createLinkedAccount(
		org: OrgForOnboarding,
		profile: Pick<
			CreatePayoutProfileInput,
			| "legalEntityName"
			| "businessType"
			| "pan"
			| "signatoryEmail"
			| "signatoryPhone"
		>,
	): Promise<{ accountId: string }> {
		this.logger.log(
			`Creating Razorpay linked account for org: ${org.organizationName}`,
		);

		const body = {
			email: org.email ?? profile.signatoryEmail,
			profile: {
				category: "not_for_profit_organization",
				subcategory: "charity",
				addresses: {
					registered: {
						street1: org.address ?? "",
						city: org.city ?? "",
						state: org.state ?? "",
						postal_code: org.pincode ?? "000000",
						country: "IN",
					},
				},
			},
			type: toRazorpayEntityType(org.orgType),
			legal_business_name: profile.legalEntityName,
			business_name: org.organizationName,
			legal_info: {
				pan: profile.pan,
				gst: "", // Not mandatory for NGOs
			},
			contact_name: org.organizationName,
			contact_info: {
				phone: org.phone ?? profile.signatoryPhone,
			},
		};

		const result = await this.razorpayFetch<{ id: string }>("/v1/accounts", {
			method: "POST",
			body: JSON.stringify(body),
		});

		return { accountId: result.id };
	}

	/**
	 * Step 2 — Add the authorised signatory as a stakeholder.
	 *
	 * Razorpay ref: `POST /v1/accounts/{id}/stakeholders`
	 */
	async createStakeholder(
		accountId: string,
		profile: PayoutProfileForOnboarding,
	): Promise<{ stakeholderId: string }> {
		this.logger.log(`Creating stakeholder for Razorpay account: ${accountId}`);

		const body: Record<string, unknown> = {
			name: profile.signatoryName,
			email: profile.signatoryEmail,
			phone: {
				primary: profile.signatoryPhone,
			},
			relationship: {
				executive: true,
				director: true,
			},
		};

		if (profile.signatoryPan) {
			body.kyc = { pan: profile.signatoryPan };
		}

		if (profile.signatoryDob) {
			// Razorpay expects DD/MM/YYYY
			const [yyyy, mm, dd] = profile.signatoryDob.split("-");
			body.birth_date = `${dd}/${mm}/${yyyy}`;
		}

		if (profile.signatoryAddress) {
			body.addresses = {
				residential: {
					street1: profile.signatoryAddress,
					country: "IN",
				},
			};
		}

		const result = await this.razorpayFetch<{ id: string }>(
			`/v1/accounts/${accountId}/stakeholders`,
			{ method: "POST", body: JSON.stringify(body) },
		);

		return { stakeholderId: result.id };
	}

	/**
	 * Step 3 — Request the Route product for the linked account.
	 *
	 * Razorpay ref: `POST /v1/accounts/{id}/products`
	 */
	async requestRouteProduct(accountId: string): Promise<{ productId: string }> {
		this.logger.log(
			`Requesting Route product for Razorpay account: ${accountId}`,
		);

		const body = {
			product_name: "route",
			tnc_accepted: true,
		};

		const result = await this.razorpayFetch<{ id: string }>(
			`/v1/accounts/${accountId}/products`,
			{ method: "POST", body: JSON.stringify(body) },
		);

		return { productId: result.id };
	}

	/**
	 * Step 4 — Attach the bank account to the Route product.
	 *
	 * The caller is responsible for decrypting the bank account number and
	 * passing it as plaintext. This method never logs the account number.
	 *
	 * Razorpay ref: `PATCH /v1/accounts/{id}/products/{productId}`
	 */
	async linkBankAccount(
		accountId: string,
		productId: string,
		profile: PayoutProfileForOnboarding,
		plaintextAccountNumber: string,
	): Promise<void> {
		this.logger.log(
			`Linking bank account (****${profile.bankAccountLast4}) for Razorpay account: ${accountId}`,
		);

		const body = {
			settlements: {
				account_number: plaintextAccountNumber,
				ifsc_code: profile.ifsc,
				beneficiary_name: profile.accountHolderName,
			},
		};

		await this.razorpayFetch<unknown>(
			`/v1/accounts/${accountId}/products/${productId}`,
			{ method: "PATCH", body: JSON.stringify(body) },
		);
	}

	/**
	 * Fetches the current live status and requirements of a linked account.
	 * Razorpay ref: `GET /v1/accounts/{id}`
	 */
	async getAccount(
		accountId: string,
	): Promise<{ id: string; status: string; requirements?: unknown }> {
		this.logger.log(`Fetching status for Razorpay account: ${accountId}`);
		return this.razorpayFetch<{ id: string; status: string }>(
			`/v1/accounts/${accountId}`,
			{ method: "GET" },
		);
	}

	/**
	 * Initiates a full or partial refund of a payment.
	 * When reverseAll=true, reverses all Route transfers made to linked accounts.
	 * Razorpay ref: `POST /v1/payments/{id}/refund`
	 */
	async refundPayment(
		paymentId: string,
		amountMinor: number,
		reverseAll = true,
	): Promise<{ id: string }> {
		this.logger.log(`Initiating refund for payment ${paymentId}`);

		const body: Record<string, unknown> = {
			amount: amountMinor,
		};
		if (reverseAll) {
			body.reverse_all = 1;
		}

		return this.razorpayFetch<{ id: string }>(
			`/v1/payments/${paymentId}/refund`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}
}
