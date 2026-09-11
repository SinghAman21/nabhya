import { env } from "@nabhya/env/server";
import { Global, Module } from "@nestjs/common";
import { MailService } from "./mail.service";

@Global()
@Module({
	providers: [MailService],
	exports: [MailService],
})
export class MailModule {
	constructor() {
		if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
			throw new Error("RESEND_API_KEY is required in production.");
		}
	}
}
