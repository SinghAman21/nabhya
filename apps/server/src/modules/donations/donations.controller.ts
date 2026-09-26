import type { CreateDonationInput, DonationQuery } from "@nabhya/shared";
import { createDonationSchema, donationQuerySchema } from "@nabhya/shared";
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
	CurrentUser,
	OptionalAuth,
	Public,
	Roles,
} from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { DonationsService } from "./donations.service";

@ApiTags("Donations")
@Controller()
export class DonationsController {
	constructor(
		@Inject(DonationsService)
		private readonly donationsService: DonationsService,
	) {}

	@OptionalAuth()
	@Throttle({ strict: { limit: 10, ttl: 60_000 } })
	@Post("donations/checkout")
	@ApiOperation({
		summary:
			"Start a donation. Signed-in donors are attributed automatically; " +
			"guests must supply an email for the receipt.",
	})
	createCheckout(
		@CurrentUser() user: AuthUser | undefined,
		@Body(new ZodValidationPipe(createDonationSchema))
		body: CreateDonationInput,
	) {
		return this.donationsService.createCheckout(
			body,
			user ? { id: user.id, email: user.email, name: user.name } : null,
		);
	}

	/**
	 * Provider callback. Public because the payment provider has no session -
	 * authenticity comes from the signature over the raw body, not from auth.
	 */
	@Public()
	// Never throttled: the provider retries on failure, and a 429 would drop a
	// payment confirmation we can never reconstruct. Authenticity comes from the
	// signature, so the endpoint is not open to meaningful abuse.
	@SkipThrottle()
	@Post("donations/webhook")
	@ApiOperation({ summary: "Payment provider webhook (signature-verified)" })
	handleWebhook(@Req() request: Request & { rawBody?: Buffer }) {
		const rawBody = request.rawBody?.toString("utf8");
		if (!rawBody) {
			throw new BadRequestException("Missing request body");
		}

		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(request.headers)) {
			if (typeof value === "string") headers[key.toLowerCase()] = value;
		}

		return this.donationsService.handleWebhook(rawBody, headers);
	}

	@Get("me/donations")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "The caller's donation history" })
	listMine(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(donationQuerySchema)) query: DonationQuery,
	) {
		return this.donationsService.listMine(user.id, query);
	}

	@Get("me/donations/:id/receipt")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Receipt for a completed donation" })
	getReceipt(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.donationsService.getReceipt(user.id, id);
	}

	@Get("org/donations")
	@Roles("organisation")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Donations received, with totals" })
	listForOrg(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(donationQuerySchema)) query: DonationQuery,
	) {
		return this.donationsService.listForMyOrganization(user.id, query);
	}
}
