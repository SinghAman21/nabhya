import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
	controllers: [UploadsController],
	providers: [UploadsService],
	// Exported so the users and organizations modules can verify an uploaded
	// object exists before persisting its key against a document row.
	exports: [UploadsService],
})
export class UploadsModule {}
