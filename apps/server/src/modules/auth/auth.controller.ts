import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthService } from "./auth.service";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";
import { LoginSchema, RegisterSchema } from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post("login")
	login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
		return this.authService.login(body);
	}

	@Public()
	@Post("register")
	register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto) {
		return this.authService.register(body);
	}
}
