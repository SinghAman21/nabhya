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
import type { LoginDto, RegisterDto } from "./dto/auth.dto";
import {
	LoginBodyDto,
	LoginSchema,
	MessageResponseDto,
	RegisterBodyDto,
	RegisterSchema,
} from "./dto/auth.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post("login")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Log in with email and password" })
	@ApiBody({ type: LoginBodyDto })
	@ApiOkResponse({ type: MessageResponseDto, description: "Login successful" })
	@ApiBadRequestResponse({ description: "Validation failed" })
	login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
		return this.authService.login(body);
	}

	@Public()
	@Post("register")
	@ApiOperation({ summary: "Register a new user account" })
	@ApiBody({ type: RegisterBodyDto })
	@ApiCreatedResponse({
		type: MessageResponseDto,
		description: "User registered successfully",
	})
	@ApiBadRequestResponse({ description: "Validation failed" })
	register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto) {
		return this.authService.register(body);
	}
}
