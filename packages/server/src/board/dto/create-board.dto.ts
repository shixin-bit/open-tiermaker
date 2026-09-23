import { IsString, IsOptional, MaxLength } from "class-validator";

export class CreateBoardDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
