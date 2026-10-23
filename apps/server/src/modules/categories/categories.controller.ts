import type { CreateCategoryInput, UpdateCategoryInput } from "@nabhya/shared";
import { createCategorySchema, updateCategorySchema } from "@nabhya/shared";
import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Public, Roles } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/pipes";
import type { AuthUser } from "../../common/types";
import { CategoriesService } from "./categories.service";

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
	constructor(
		@Inject(CategoriesService)
		private readonly categoriesService: CategoriesService,
	) {}

	@Public()
	@Get()
	@ApiOperation({ summary: "List active cause categories (public)" })
	list() {
		return this.categoriesService.listActive();
	}

	@Get("admin")
	@Roles("superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "List active and archived categories for management",
	})
	listForAdmin() {
		return this.categoriesService.listAll();
	}

	@Post("admin")
	@Roles("superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Create a cause category" })
	create(
		@CurrentUser() admin: AuthUser,
		@Body(new ZodValidationPipe(createCategorySchema))
		body: CreateCategoryInput,
	) {
		return this.categoriesService.create(admin.id, body);
	}

	@Patch("admin/:id")
	@Roles("superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({ summary: "Edit or reactivate a cause category" })
	update(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body(new ZodValidationPipe(updateCategorySchema))
		body: UpdateCategoryInput,
	) {
		return this.categoriesService.update(admin.id, id, body);
	}

	@Delete("admin/:id")
	@Roles("superadmin")
	@ApiBearerAuth("access-token")
	@ApiOperation({
		summary: "Archive a category without deleting its assignments",
	})
	archive(
		@CurrentUser() admin: AuthUser,
		@Param("id", ParseUUIDPipe) id: string,
	) {
		return this.categoriesService.archive(admin.id, id);
	}
}
