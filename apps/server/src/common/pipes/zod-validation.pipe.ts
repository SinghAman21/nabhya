import {
	BadRequestException,
	Injectable,
	type PipeTransform,
} from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * A NestJS pipe that validates incoming request data (body, query, param)
 * against a Zod schema.
 *
 * Usage in a controller:
 *   @Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserDto
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
	constructor(private schema: ZodSchema) {}

	transform(value: unknown) {
		const result = this.schema.safeParse(value);
		if (!result.success) {
			throw new BadRequestException({
				message: "Validation failed",
				errors: result.error.flatten().fieldErrors,
			});
		}
		return result.data;
	}
}
