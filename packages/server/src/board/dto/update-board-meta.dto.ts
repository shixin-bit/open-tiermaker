import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsNotEmpty,
} from "class-validator";
import type { BoardVisibility } from "@prisma/client";

export class UpdateBoardMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(["private", "public", "unlisted"])
  visibility?: BoardVisibility;

  @IsOptional()
  @IsString()
  sharePassword?: string;
}
