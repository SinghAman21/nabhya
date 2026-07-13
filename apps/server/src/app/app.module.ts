import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../common/database";
import { JwtGuard, RolesGuard } from "../common/guards";
import { UsersModule } from "../modules/users/users.module";
import { AppController } from "./app.controller";

@Module({
	imports: [
		DatabaseModule, // global — provides db to the whole app
		UsersModule,
	],
	providers: [
		{
			provide: APP_GUARD,
			useClass: JwtGuard,
		},
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
	],
	controllers: [AppController],
})
export class AppModule {}
