import { Module } from "@nestjs/common";
import { DatabaseModule } from "../common/database";
import { AuthModule } from "../modules/auth/auth.module";
import { AppController } from "./app.controller";

@Module({
	imports: [
		DatabaseModule, // global — provides db to the whole app
		AuthModule,
		// Add new feature modules here as you build them
	],
	controllers: [AppController],
})
export class AppModule {}
