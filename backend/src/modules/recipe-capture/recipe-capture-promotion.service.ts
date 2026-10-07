import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RecipeCaptureStatus } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/services/prisma.service";
import { ModulesService } from "../modules/modules.service";
import { CreateRecipeDto } from "../recipes/dto/create-recipe.dto";
import { RecipesService } from "../recipes/recipes.service";
import { RoleAccessService } from "../role-access/role-access.service";
import {
  buildPendingNotes,
  splitIngredientsForRecipe,
} from "./capture-promotion";
import { assertTenant } from "./recipe-capture.service";

/** Un paso a Recetas que lleva más que esto en curso se da por interrumpido y se puede retomar. */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;
const IN_PROGRESS = "Ya se está pasando a Recetas";

export interface PromotionResult {
  recipeId: string;
  /** Ingredientes que pasaron como líneas / que quedaron en notas. null si la receta ya existía. */
  lines: number | null;
  toNotes: number | null;
}

interface ClaimedCapture {
  id: string;
  name: string | null;
  description: string | null;
  elaboration: string | null;
  portions: number | null;
  preparationTimeMinutes: number | null;
  cookingTimeMinutes: number | null;
  sourceUrl: string | null;
}

/**
 * Convierte una captura revisada en una receta real.
 *
 * Crear la receta no es idempotente y no se puede meter en la misma
 * transacción que el cambio de estado de la captura, así que el paso es
 * recuperable en vez de atómico: se reclama la captura (PASANDO) con un id de
 * receta reservado y, si algo falla a medias, ese id dice si la receta llegó
 * a crearse. Así nunca salen dos recetas de una captura.
 */
@Injectable()
export class RecipeCapturePromotionService {
  private readonly logger = new Logger(RecipeCapturePromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly modules: ModulesService,
    private readonly roleAccess: RoleAccessService,
  ) {}

  async promote(
    tenantId: string,
    role: string | undefined,
    captureId: string,
  ): Promise<PromotionResult> {
    assertTenant(tenantId);
    await this.assertCanCreateRecipes(tenantId, role);

    const capture = await this.prisma.recipeCapture.findFirst({
      where: {
        id: captureId,
        tenantId,
        status: { not: RecipeCaptureStatus.DESCARTADA },
      },
    });
    if (!capture) {
      throw new NotFoundException("Captura no encontrada");
    }

    if (capture.status === RecipeCaptureStatus.PASADA) {
      // Las recetas se borran lógicamente, así que el enlace sigue ahí:
      // hay que mirar si la receta sigue viva.
      if (
        !capture.recipeId ||
        !(await this.recipeIsAlive(tenantId, capture.recipeId))
      ) {
        throw new ConflictException(
          "La receta de esta captura se eliminó; vuelve a capturarla",
        );
      }
      return { recipeId: capture.recipeId, lines: null, toNotes: null };
    }

    if (capture.status === RecipeCaptureStatus.PASANDO) {
      const age = Date.now() - (capture.claimedAt?.getTime() ?? 0);
      if (age < CLAIM_TIMEOUT_MS) {
        throw new ConflictException(IN_PROGRESS);
      }
      // Paso interrumpido (p. ej. reinicio del servidor): si la receta
      // reservada llegó a crearse solo falta enlazarla.
      if (
        capture.reservedRecipeId &&
        (await this.recipeExists(tenantId, capture.reservedRecipeId))
      ) {
        return {
          recipeId: await this.finish(capture.id, capture.reservedRecipeId),
          lines: null,
          toNotes: null,
        };
      }
    } else if (capture.status !== RecipeCaptureStatus.PENDIENTE) {
      throw new ConflictException(
        "Solo se pueden pasar a Recetas las capturas listas para revisar",
      );
    }

    // Reclamo: solo una petición consigue cambiar el estado que acaba de leer.
    const recipeId = randomUUID();
    const { count } = await this.prisma.recipeCapture.updateMany({
      where: {
        id: capture.id,
        tenantId,
        status: capture.status,
        claimedAt: capture.claimedAt,
      },
      data: {
        status: RecipeCaptureStatus.PASANDO,
        reservedRecipeId: recipeId,
        claimedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException(IN_PROGRESS);
    }

    return this.createRecipe(tenantId, capture, recipeId);
  }

  private async createRecipe(
    tenantId: string,
    capture: ClaimedCapture,
    recipeId: string,
  ): Promise<PromotionResult> {
    let split;
    try {
      const ingredients = await this.prisma.recipeCaptureIngredient.findMany({
        where: { captureId: capture.id },
        orderBy: { sortOrder: "asc" },
        include: {
          matchedProduct: {
            select: { id: true, referenceUnit: true, deletedAt: true },
          },
        },
      });
      split = splitIngredientsForRecipe(ingredients);
      const notes = buildPendingNotes(split.pending);

      const dto = await this.toValidDto({
        name: capture.name,
        description: capture.description ?? undefined,
        elaboration: capture.elaboration ?? undefined,
        portions: capture.portions ?? 1,
        preparationTimeMinutes: capture.preparationTimeMinutes ?? undefined,
        cookingTimeMinutes: capture.cookingTimeMinutes ?? undefined,
        sourceUrl: capture.sourceUrl ?? undefined,
        ingredients: split.lines,
        notes: notes ?? undefined,
        // Con ingredientes sin vincular los alérgenos de la receta están
        // incompletos: se crea inactiva para que no llegue a fichas,
        // etiquetas ni menú digital hasta que alguien la complete.
        isActive: notes === null,
        isPublic: false,
      });

      await this.recipes.create(tenantId, dto, { id: recipeId });
    } catch (error: any) {
      // `create` guarda la receta y después sigue consultando para montar la
      // respuesta: puede fallar con la receta ya creada. Solo se libera la
      // captura si de verdad no existe; si no, un reintento la duplicaría.
      if (!(await this.recipeExists(tenantId, recipeId))) {
        await this.release(capture.id, recipeId);
        throw error;
      }
      this.logger.warn(
        `La receta ${recipeId} se creó pero el paso de la captura ${capture.id} falló después: ${error?.message ?? error}`,
      );
    }

    return {
      recipeId: await this.finish(capture.id, recipeId),
      lines: split?.lines.length ?? null,
      toNotes: split?.pending.length ?? null,
    };
  }

  /**
   * Pasar una captura crea una receta: exige lo mismo que crearla a mano. El
   * guard de secciones solo comprueba las que se le declaran y no deduce que
   * `recipes.edit` implica tener acceso a `recipes`, y el de módulos solo mira
   * el de este controlador.
   */
  private async assertCanCreateRecipes(
    tenantId: string,
    role: string | undefined,
  ): Promise<void> {
    const allowed =
      (await this.modules.isModuleEnabled(tenantId, "recipes")) &&
      (await this.roleAccess.isSectionAllowed(tenantId, role, "recipes")) &&
      (await this.roleAccess.isSectionAllowed(tenantId, role, "recipes.edit"));
    if (!allowed) {
      throw new ForbiddenException("No tienes permiso para crear recetas");
    }
  }

  /** Llamando al servicio directamente no pasa por el ValidationPipe: se valida aquí. */
  private async toValidDto(
    plain: Record<string, unknown>,
  ): Promise<CreateRecipeDto> {
    const dto = plainToInstance(CreateRecipeDto, plain);
    const errors = await validate(dto, { whitelist: true });
    if (errors.length) {
      throw new BadRequestException(
        "La captura tiene datos que no se pueden pasar a Recetas",
      );
    }
    return dto;
  }

  /** Consulta directa: debe ver también una receta borrada lógicamente. */
  private async recipeExists(
    tenantId: string,
    recipeId: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM recipes WHERE id = ${recipeId} AND "tenantId" = ${tenantId} LIMIT 1
    `;
    return rows.length > 0;
  }

  /**
   * Cierra el paso y devuelve la receta enlazada. Solo cierra si la captura
   * sigue reclamada con ESTE id: si otra petición la re-reclamó (este paso
   * tardó más que el plazo), manda la suya y se devuelve esa.
   */
  private async finish(captureId: string, recipeId: string): Promise<string> {
    const { count } = await this.prisma.recipeCapture.updateMany({
      where: {
        id: captureId,
        status: RecipeCaptureStatus.PASANDO,
        reservedRecipeId: recipeId,
      },
      data: { status: RecipeCaptureStatus.PASADA, recipeId },
    });
    if (count === 1) {
      return recipeId;
    }
    const current = await this.prisma.recipeCapture.findUnique({
      where: { id: captureId },
      select: { recipeId: true },
    });
    if (!current?.recipeId) {
      throw new ConflictException(IN_PROGRESS);
    }
    return current.recipeId;
  }

  private async recipeIsAlive(
    tenantId: string,
    recipeId: string,
  ): Promise<boolean> {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    return recipe !== null;
  }

  private async release(captureId: string, recipeId: string): Promise<void> {
    await this.prisma.recipeCapture.updateMany({
      where: {
        id: captureId,
        status: RecipeCaptureStatus.PASANDO,
        reservedRecipeId: recipeId,
      },
      data: {
        status: RecipeCaptureStatus.PENDIENTE,
        reservedRecipeId: null,
        claimedAt: null,
      },
    });
  }
}
