import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

/**
 * Global so any feature module can inject AuditService without wiring imports.
 * Mirrors DatabaseModule, which it depends on.
 */
@Global()
@Module({
	providers: [AuditService],
	exports: [AuditService],
})
export class AuditModule {}
