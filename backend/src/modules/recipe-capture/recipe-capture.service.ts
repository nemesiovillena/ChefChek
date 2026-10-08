import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RecipeCaptureSource, RecipeCaptureStatus } from "@prisma/client";
import { PrismaService } from "../../common/services/prisma.service";
import { AssistantCompletionError } from "../ai-assistant/assistant-completion.service";
import { CaptureIngredientMatcher } from "./capture-ingredient-matcher";
import { RecipeCaptureCompletionService } from "./recipe-capture-completion.service";
import {
  RecipeStructuringError,
  RecipeStructuringService,
  StructuringInput,
} from "./recipe-structuring.service";
import { extractRecipeSourceText } from "./source/recipe-html-extractor";
import { fetchPublicPage, PageFetchError } from "./source/safe-page-fetcher";

/** Capturas que un tenant puede tener procesándose a la vez (cada una es una llamada de pago a la IA). */
const MAX_CONCURRENT_CAPTURES = 3;
/** Una captura que lleva más que esto procesando se quedó huérfana (reinicio del servidor). */
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const STALE_MESSAGE = "Se interrumpió, vuelve a intentarlo";
const UNEXPECTED_MESSAGE =
  "No se pudo procesar la receta. Vuelve a intentarlo.";

/** Archivos que la IA puede leer como adjunto. */
export const CAPTURE_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export interface CaptureFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

/** Lo que hace falta para procesar una captura; no se guarda en base de datos. */
type CaptureWork =
  | { source: "URL"; url: string }
  | { source: "TEXTO"; text: string }
  | { source: "ARCHIVO"; file: CaptureFile };

const LIST_SELECT = {
  id: true,
  source: true,
  sourceUrl: true,
  sourceFileName: true,
  sourceFileMimeType: true,
  status: true,
  errorMessage: true,
  name: true,
  recipeId: true,
  claimedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Campos del detalle de una captura (todo lo que ve la pantalla de revisión). */
const DETAIL_SELECT = {
  ...LIST_SELECT,
  sourceText: true,
  description: true,
  elaboration: true,
  portions: true,
  preparationTimeMinutes: true,
  cookingTimeMinutes: true,
} as const;

/**
 * Capturas de recetas: una receta externa (URL, texto o foto/PDF) que la IA
 * convierte a nuestro formato y queda en revisión hasta pasarla a Recetas.
 */
@Injectable()
export class RecipeCaptureService {
  private readonly logger = new Logger(RecipeCaptureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly completion: RecipeCaptureCompletionService,
    private readonly structuring: RecipeStructuringService,
    private readonly matcher: CaptureIngredientMatcher,
  ) {}

  async findAll(tenantId: string) {
    assertTenant(tenantId);
    await this.failStaleCaptures(tenantId);
    const captures = await this.prisma.recipeCapture.findMany({
      where: { tenantId, status: { not: RecipeCaptureStatus.DESCARTADA } },
      select: { ...LIST_SELECT, recipe: { select: { deletedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return captures.map(({ recipe, sourceFileMimeType, ...capture }) => ({
      ...capture,
      recipeId: liveRecipeId(capture.recipeId, recipe),
      canRetry: canRetryCapture(capture, sourceFileMimeType),
    }));
  }

  async findOne(tenantId: string, id: string) {
    assertTenant(tenantId);
    const capture = await this.prisma.recipeCapture.findFirst({
      where: { id, tenantId, status: { not: RecipeCaptureStatus.DESCARTADA } },
      select: {
        ...DETAIL_SELECT,
        ingredients: {
          orderBy: { sortOrder: "asc" },
          include: {
            matchedProduct: {
              select: { id: true, name: true, deletedAt: true },
            },
          },
        },
        recipe: { select: { deletedAt: true } },
      },
    });
    if (!capture) {
      throw new NotFoundException("Captura no encontrada");
    }
    const { recipe, sourceFileMimeType, ...rest } = capture;
    return {
      ...rest,
      recipeId: liveRecipeId(capture.recipeId, recipe),
      canRetry: canRetryCapture(capture, sourceFileMimeType),
    };
  }

  createFromUrl(tenantId: string, userId: string | undefined, url: string) {
    return this.create(
      tenantId,
      userId,
      { source: RecipeCaptureSource.URL, sourceUrl: url },
      { source: "URL", url },
    );
  }

  createFromText(tenantId: string, userId: string | undefined, text: string) {
    return this.create(
      tenantId,
      userId,
      { source: RecipeCaptureSource.TEXTO, sourceText: text },
      { source: "TEXTO", text },
    );
  }

  async createFromFile(
    tenantId: string,
    userId: string | undefined,
    file: CaptureFile,
  ) {
    if (!CAPTURE_FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        "Formato no admitido. Usa una foto JPG o PNG, o un PDF.",
      );
    }
    return this.create(
      tenantId,
      userId,
      {
        source: RecipeCaptureSource.ARCHIVO,
        sourceFileName: file.filename,
        // Se guarda el archivo para poder reintentar si la IA falla.
        sourceFile: file.buffer,
        sourceFileMimeType: file.mimetype,
      },
      { source: "ARCHIVO", file },
    );
  }

  /** Cambia o quita el artículo vinculado a un ingrediente de una captura en revisión. */
  async updateIngredient(
    tenantId: string,
    captureId: string,
    ingredientId: string,
    matchedProductId: string | null,
  ) {
    assertTenant(tenantId);
    const ingredient = await this.prisma.recipeCaptureIngredient.findFirst({
      where: { id: ingredientId, captureId, capture: { tenantId } },
      select: { id: true, capture: { select: { status: true } } },
    });
    if (
      !ingredient ||
      ingredient.capture.status === RecipeCaptureStatus.DESCARTADA
    ) {
      throw new NotFoundException("Ingrediente no encontrado");
    }
    if (ingredient.capture.status !== RecipeCaptureStatus.PENDIENTE) {
      throw new BadRequestException(
        "Solo se pueden editar capturas pendientes de revisión",
      );
    }
    if (matchedProductId) {
      const product = await this.prisma.product.findFirst({
        where: { id: matchedProductId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!product) {
        throw new BadRequestException("Artículo no encontrado");
      }
    }
    await this.prisma.recipeCaptureIngredient.update({
      where: { id: ingredientId },
      // Elegido por el usuario: deja de ser una sugerencia automática.
      data: { matchedProductId, matchConfidence: null },
    });
    return this.findOne(tenantId, captureId);
  }

  /** Descarta una captura. No se borra: pasa a DESCARTADA y deja de listarse. */
  async discard(tenantId: string, id: string): Promise<void> {
    assertTenant(tenantId);
    const { count } = await this.prisma.recipeCapture.updateMany({
      where: {
        id,
        tenantId,
        status: {
          in: [
            RecipeCaptureStatus.PENDIENTE,
            RecipeCaptureStatus.ERROR,
            RecipeCaptureStatus.PROCESANDO,
            RecipeCaptureStatus.PASADA,
          ],
        },
      },
      // Ya no hace falta: se libera el archivo guardado.
      data: {
        status: RecipeCaptureStatus.DESCARTADA,
        sourceFile: null,
        sourceFileMimeType: null,
      },
    });
    if (count === 0) {
      throw new NotFoundException("Captura no encontrada");
    }
  }

  /**
   * Reintenta una captura que quedó en ERROR (p. ej. porque la IA estaba
   * saturada). Se rehace desde la fuente guardada: enlace, texto o el propio
   * archivo. Las capturas de archivo anteriores a guardar el archivo no se
   * pueden reintentar y lo dicen con un mensaje claro.
   */
  async retry(tenantId: string, id: string) {
    assertTenant(tenantId);
    const capture = await this.prisma.recipeCapture.findFirst({
      where: { id, tenantId, status: RecipeCaptureStatus.ERROR },
    });
    if (!capture) {
      throw new NotFoundException(
        "No hay ninguna captura con error que reintentar",
      );
    }
    const work = workFromCapture(capture);
    // Sin IA configurada volvería a fallar sin remedio: mejor decirlo antes.
    await this.completion.assertConfigured(tenantId);
    await this.failStaleCaptures(tenantId);

    const processing = await this.prisma.recipeCapture.count({
      where: { tenantId, status: RecipeCaptureStatus.PROCESANDO },
    });
    if (processing >= MAX_CONCURRENT_CAPTURES) {
      throw new HttpException(
        "Espera a que terminen las capturas en curso",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Un reintento empieza de cero: fuera lo que quedara del intento previo.
      await tx.recipeCaptureIngredient.deleteMany({
        where: { captureId: id },
      });
      await tx.recipeCapture.update({
        where: { id },
        data: {
          status: RecipeCaptureStatus.PROCESANDO,
          errorMessage: null,
          name: null,
          description: null,
          elaboration: null,
          portions: null,
          preparationTimeMinutes: null,
          cookingTimeMinutes: null,
        },
      });
    });

    this.processInBackground(tenantId, id, work).catch((error) => {
      this.logger.error(
        `Fallo no controlado reintentando la captura ${id}: ${error}`,
      );
    });

    return this.findOne(tenantId, id);
  }

  /**
   * Crea el registro en PROCESANDO y devuelve al instante; la descarga y la
   * llamada a la IA siguen en segundo plano y el frontend sondea el estado.
   */
  private async create(
    tenantId: string,
    userId: string | undefined,
    data: {
      source: RecipeCaptureSource;
      sourceUrl?: string;
      sourceText?: string;
      sourceFileName?: string;
      /** Solo ARCHIVO: el archivo original, para poder reintentar. */
      sourceFile?: Buffer;
      sourceFileMimeType?: string;
    },
    work: CaptureWork,
  ) {
    assertTenant(tenantId);
    // Antes de crear nada: sin IA configurada la captura nunca podría terminar.
    await this.completion.assertConfigured(tenantId);
    await this.failStaleCaptures(tenantId);

    const processing = await this.prisma.recipeCapture.count({
      where: { tenantId, status: RecipeCaptureStatus.PROCESANDO },
    });
    if (processing >= MAX_CONCURRENT_CAPTURES) {
      throw new HttpException(
        "Espera a que terminen las capturas en curso",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const capture = await this.prisma.recipeCapture.create({
      data: { ...data, tenantId, createdBy: userId },
      select: LIST_SELECT,
    });

    this.processInBackground(tenantId, capture.id, work).catch((error) => {
      this.logger.error(
        `Fallo no controlado procesando la captura ${capture.id}: ${error}`,
      );
    });

    const { sourceFileMimeType, ...rest } = capture;
    return { ...rest, canRetry: canRetryCapture(capture, sourceFileMimeType) };
  }

  private async processInBackground(
    tenantId: string,
    captureId: string,
    work: CaptureWork,
  ): Promise<void> {
    try {
      const recipe = await this.structuring.structure(
        tenantId,
        await this.toStructuringInput(work),
      );

      const ingredients = [];
      for (const [index, ingredient] of recipe.ingredients.entries()) {
        const match = await this.matcher.match(tenantId, ingredient.name);
        ingredients.push({
          ...ingredient,
          sortOrder: index,
          matchedProductId: match?.productId ?? null,
          matchConfidence: match?.confidence ?? null,
        });
      }

      await this.prisma.$transaction(async (tx) => {
        // Solo si sigue PROCESANDO: si entretanto se descartó o se dio por
        // interrumpida, este resultado tardío no debe pisar ese estado.
        const { count } = await tx.recipeCapture.updateMany({
          where: { id: captureId, status: RecipeCaptureStatus.PROCESANDO },
          data: {
            status: RecipeCaptureStatus.PENDIENTE,
            errorMessage: null,
            name: recipe.name,
            description: recipe.description,
            elaboration: JSON.stringify({ steps: recipe.steps }),
            portions: recipe.portions,
            preparationTimeMinutes: recipe.preparationTimeMinutes,
            cookingTimeMinutes: recipe.cookingTimeMinutes,
            // Ya procesada: el archivo original deja de hacer falta.
            sourceFile: null,
            sourceFileMimeType: null,
          },
        });
        if (count === 0) {
          return;
        }
        await tx.recipeCaptureIngredient.createMany({
          data: ingredients.map((ingredient) => ({ ...ingredient, captureId })),
        });
      });
    } catch (error: any) {
      // Solo los errores propios (descarga, IA, validación) traen un mensaje
      // escrito para el usuario; cualquier otro es interno y no se muestra.
      const forUser =
        error instanceof PageFetchError ||
        error instanceof RecipeStructuringError ||
        error instanceof AssistantCompletionError;
      if (!forUser) {
        this.logger.error(
          `Error procesando la captura ${captureId}: ${error?.message ?? error}`,
          error?.stack,
        );
      }
      await this.markError(
        captureId,
        forUser ? error.message : UNEXPECTED_MESSAGE,
      );
    }
  }

  private async toStructuringInput(
    work: CaptureWork,
  ): Promise<StructuringInput> {
    if (work.source === "URL") {
      const html = await fetchPublicPage(work.url);
      return { text: extractRecipeSourceText(html) };
    }
    if (work.source === "TEXTO") {
      return { text: work.text };
    }
    return {
      attachment: {
        mimeType: work.file.mimetype,
        dataBase64: work.file.buffer.toString("base64"),
      },
    };
  }

  private async markError(captureId: string, message: string): Promise<void> {
    await this.prisma.recipeCapture.updateMany({
      where: { id: captureId, status: RecipeCaptureStatus.PROCESANDO },
      data: { status: RecipeCaptureStatus.ERROR, errorMessage: message },
    });
  }

  /**
   * El trabajo en segundo plano vive en memoria: si el servidor se reinicia,
   * la captura se quedaría PROCESANDO para siempre. Se cierran como error al
   * leer o crear, sin tarea programada.
   */
  private async failStaleCaptures(tenantId: string): Promise<void> {
    await this.prisma.recipeCapture.updateMany({
      where: {
        tenantId,
        status: RecipeCaptureStatus.PROCESANDO,
        createdAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
      },
      data: { status: RecipeCaptureStatus.ERROR, errorMessage: STALE_MESSAGE },
    });
  }
}

/**
 * Las recetas se borran lógicamente, así que `recipeId` sigue apuntando a
 * una receta eliminada: para el cliente esa captura ya no tiene receta.
 */
function liveRecipeId(
  recipeId: string | null,
  recipe: { deletedAt: Date | null } | null,
): string | null {
  return recipe && !recipe.deletedAt ? recipeId : null;
}

/**
 * Un SUPERADMIN no tiene tenant y los guards le dejan pasar: con `tenantId`
 * indefinido Prisma ignora el filtro y la consulta abarcaría todos los
 * tenants. Mejor fallar que leer datos de otro cliente.
 */
export function assertTenant(tenantId: string | undefined): asserts tenantId {
  if (!tenantId) {
    throw new BadRequestException("Esta función requiere un cliente activo");
  }
}

/** URL y texto siempre guardan su fuente; archivo solo si conserva el archivo. */
function canRetryCapture(
  capture: { source: RecipeCaptureSource },
  sourceFileMimeType: string | null,
): boolean {
  return capture.source !== RecipeCaptureSource.ARCHIVO || !!sourceFileMimeType;
}

/** Reconstruye la fuente original de una captura para rehacer su procesado. */
function workFromCapture(capture: {
  source: RecipeCaptureSource;
  sourceUrl: string | null;
  sourceText: string | null;
  sourceFileName: string | null;
  sourceFile: Uint8Array | null;
  sourceFileMimeType: string | null;
}): CaptureWork {
  if (capture.source === RecipeCaptureSource.URL && capture.sourceUrl) {
    return { source: "URL", url: capture.sourceUrl };
  }
  if (capture.source === RecipeCaptureSource.TEXTO && capture.sourceText) {
    return { source: "TEXTO", text: capture.sourceText };
  }
  if (
    capture.source === RecipeCaptureSource.ARCHIVO &&
    capture.sourceFile &&
    capture.sourceFileMimeType
  ) {
    return {
      source: "ARCHIVO",
      file: {
        buffer: Buffer.from(capture.sourceFile),
        filename: capture.sourceFileName ?? "receta",
        mimetype: capture.sourceFileMimeType,
      },
    };
  }
  throw new BadRequestException(
    "No se puede reintentar esta captura: vuelve a subir la foto o el PDF.",
  );
}
