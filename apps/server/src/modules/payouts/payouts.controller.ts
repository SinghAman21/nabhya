import {
	createPayoutProfileSchema,
	type PayoutProfileView,
} from "@nabhya/shared";
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { PayoutsService } from "./payouts.service";

@ApiTags("Payouts")
@Controller()
export class PayoutsController {
	constructor(
		@Inject(PayoutsService) private readonly payouts: PayoutsService,
	) {}

	// ─── NGO Routes ─────────────────────────────────────────────────────────────

	@Get("org/payout")
	@Roles("organisation")
	@ApiOperation({ summary: "Get the calling NGO's payout profile" })
	async getMyPayoutProfile(
		@CurrentUser() user: AuthUser,
	): Promise<PayoutProfileView | null> {
		return this.payouts.getMyPayoutProfile(user.id);
	}

	@Post("org/payout")
	@Roles("organisation")
	@ApiOperation({
		summary: "Submit or update the NGO's payout / banking profile",
	})
	async savePayoutProfile(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createPayoutProfileSchema))
		body: ReturnType<typeof createPayoutProfileSchema.parse>,
	): Promise<PayoutProfileView> {
		return this.payouts.savePayoutProfile(user.id, body);
	}

	// ─── Admin Routes ────────────────────────────────────────────────────────────

	@Get("admin/organizations/:id/payout")
	@Roles("superadmin")
	@ApiOperation({ summary: "Admin: get payout profile for any NGO" })
	async getOrgPayoutProfile(
		@Param("id", ParseUUIDPipe) orgId: string,
	): Promise<PayoutProfileView | null> {
		return this.payouts.getPayoutProfileByOrgId(orgId);
	}

	@Post("admin/organizations/:id/payout/retry-sync")
	@Roles("superadmin")
	@ApiOperation({
		summary: "Admin: re-trigger Razorpay Route onboarding for a stuck profile",
	})
	async retrySync(
		@Param("id", ParseUUIDPipe) orgId: string,
	): Promise<{ message: string }> {
		await this.payouts.retrySync(orgId);
		return { message: "Onboarding retry triggered." };
	}

	@Post("admin/donations/:id/refund")
	@Roles("superadmin")
	@ApiOperation({ summary: "Admin: initiate a donation refund" })
	async refundDonation(
		@CurrentUser() user: AuthUser,
		@Param("id", ParseUUIDPipe) donationId: string,
	): Promise<{ message: string; refundId: string }> {
		return this.payouts.refundDonation(user.id, donationId);
	}
}
