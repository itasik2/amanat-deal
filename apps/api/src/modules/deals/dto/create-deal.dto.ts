import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export enum DealCategoryDto {
  GOODS = 'GOODS',
  SERVICE = 'SERVICE',
  REPAIR = 'REPAIR',
  EQUIPMENT = 'EQUIPMENT',
  OTHER = 'OTHER'
}

export enum ProtectionPlanDto {
  BASIC = 'BASIC',
  EXTENDED = 'EXTENDED'
}

export class CreateDealDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(DealCategoryDto)
  category!: DealCategoryDto;

  @IsInt()
  @Min(1000)
  amountKzt!: number;

  @IsOptional()
  @IsEnum(ProtectionPlanDto)
  protectionPlan?: ProtectionPlanDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  inspectionHours?: number;
}
