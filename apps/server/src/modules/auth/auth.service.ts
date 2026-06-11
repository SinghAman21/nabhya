import { Injectable } from "@nestjs/common";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
	// TODO: inject DB_TOKEN and implement JWT logic
	async login(_dto: LoginDto) {
		return { message: "login — not implemented yet" };
	}

	async register(_dto: RegisterDto) {
		return { message: "register — not implemented yet" };
	}
}
