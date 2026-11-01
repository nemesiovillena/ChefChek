import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

/**
 * Partial map of section-key -> boolean for a role. Unknown keys are rejected
 * by the service against SECTION_KEYS; missing keys are left unchanged.
 */
export type SectionFlagMap = Record<string, boolean>;

export class UpdateRoleAccessDto {
  @IsOptional()
  @IsObject()
  USER?: SectionFlagMap;

  @IsOptional()
  @IsObject()
  VIEWER?: SectionFlagMap;
}

/** Permisos por persona: `{ access: { "compras-pedidos": true } }`. */
export class UpdateUserAccessDto {
  @IsObject()
  access: SectionFlagMap;
}

/** Listas de compra asignadas a una persona: `{ listIds: ["..."] }`. */
export class UpdateUserPurchaseListsDto {
  @IsArray()
  @IsString({ each: true })
  listIds: string[];
}
