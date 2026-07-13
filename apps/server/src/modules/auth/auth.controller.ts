import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthService } from "./auth.service";
import type { LoginDto, RefreshTokenDto, RegisterDto } from "./dto/auth.dto";
import {
	AuthResponseDto,
	LoginBodyDto,
	LoginSchema,
	MessageResponseDto,
	RefreshTokenBodyDto,
	RefreshTokenSchema,
	RegisterBodyDto,
	RegisterSchema,
} from "./dto/auth.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: "Register a new user with role selection" })
	@ApiBody({ type: RegisterBodyDto })
	@ApiCreatedResponse({
		type: AuthResponseDto,
		description: "User registered successfully",
	})
	@ApiBadRequestResponse({ description: "Validation failed or email exists" })
	async register(
		@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto,
	) {
		return this.authService.register(body);
	}

	@Public()
	@Post("login")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Log in with email and password" })
	@ApiBody({ type: LoginBodyDto })
	@ApiOkResponse({
		type: AuthResponseDto,
		description: "Login successful",
	})
	@ApiBadRequestResponse({ description: "Invalid credentials" })
	async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
		return this.authService.login(body);
	}

	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Refresh access token" })
	@ApiBody({ type: RefreshTokenBodyDto })
	@ApiOkResponse({
		type: AuthResponseDto,
		description: "Token refreshed successfully",
	})
	@ApiBadRequestResponse({ description: "Invalid refresh token" })
	async refresh(
		@Body(new ZodValidationPipe(RefreshTokenSchema))
		body: RefreshTokenDto,
	) {
		return this.authService.refreshToken(body.refreshToken);
	}

	@Post("logout")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Logout user" })
	@ApiOkResponse({
		type: MessageResponseDto,
		description: "Logout successful",
	})
	async logout() {
		return this.authService.logout();
	}
}
