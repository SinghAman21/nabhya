import type {
	CompleteOrgOnboardingInput,
	CompleteVolunteerOnboardingInput,
} from "@nabhya/shared";
import {
	completeOrgOnboardingSchema,
	completeVolunteerOnboardingSchema,
} from "@nabhya/shared";
import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { OnboardingService } from "./onboarding.service";

@ApiTags("Onboarding")
@Controller("onboarding")
@ApiBearerAuth("access-token")
export class OnboardingController {
	constructor(
		@Inject(OnboardingService)
		private readonly onboardingService: OnboardingService,
	) {}

	@Get("status")
	@ApiOperation({
		summary: "Where the caller is in onboarding — drives client routing",
	})
	getStatus(@CurrentUser() user: AuthUser) {
		return this.onboardingService.getStatus(user);
	}

	@Post("organization")
	@Roles("organisation")
	@ApiOperation({ summary: "Submit the NGO onboarding wizard" })
	@ApiResponse({
		status: 409,
		description: "This account already owns an organization.",
	})
	completeOrganization(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(completeOrgOnboardingSchema))
		body: CompleteOrgOnboardingInput,
	) {
		return this.onboardingService.completeOrganizationOnboarding(user, body);
	}

	@Post("volunteer")
	@Roles("volunteer")
	@ApiOperation({ summary: "Submit the volunteer onboarding profile" })
	completeVolunteer(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(completeVolunteerOnboardingSchema))
		body: CompleteVolunteerOnboardingInput,
	) {
		return this.onboardingService.completeVolunteerOnboarding(user, body);
	}
}
