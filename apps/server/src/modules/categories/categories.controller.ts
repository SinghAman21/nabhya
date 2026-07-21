import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators";
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
}
