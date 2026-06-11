import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
	success: true;
	data: T;
	timestamp: string;
}

/**
 * Wraps every successful response in a consistent envelope:
 * { success: true, data: <original payload>, timestamp: <ISO string> }
 *
 * Apply globally in main.ts:
 *   app.useGlobalInterceptors(new ResponseTransformInterceptor())
 */
@Injectable()
export class ResponseTransformInterceptor<T>
	implements NestInterceptor<T, ApiResponse<T>>
{
	intercept(
		_context: ExecutionContext,
		next: CallHandler,
	): Observable<ApiResponse<T>> {
		return next.handle().pipe(
			map((data) => ({
				success: true as const,
				data,
				timestamp: new Date().toISOString(),
			})),
		);
	}
}
