import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { EtiquetadoController } from "./etiquetado.controller";
import { FoodLabelService } from "./services/food-label.service";
import { FoodLabelContextService } from "./services/food-label-context.service";
import { FoodLabelPdfService } from "./services/food-label-pdf.service";
import { FoodLabelZplService } from "./services/food-label-zpl.service";
import { EtiquetadoConfigService } from "./services/etiquetado-config.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard } from "../../guards/module.guard";
import {
  SectionAccessGuard,
  SECTION_METADATA_KEY,
} from "../../guards/section-access.guard";

describe("EtiquetadoController", () => {
  let controller: EtiquetadoController;

  const foodLabels = {
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    void: jest.fn(),
  };
  const context = {
    forRecipe: jest.fn(),
    forProduct: jest.fn(),
    searchProducts: jest.fn(),
  };

  const req = { tenantId: "t1", user: { id: "u1", name: "Ana" } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EtiquetadoController],
      providers: [
        { provide: FoodLabelService, useValue: foodLabels },
        { provide: FoodLabelContextService, useValue: context },
        { provide: FoodLabelPdfService, useValue: { generate: jest.fn() } },
        { provide: FoodLabelZplService, useValue: { generate: jest.fn() } },
        {
          provide: EtiquetadoConfigService,
          useValue: {
            getConfig: jest.fn(),
            setThermalProfiles: jest.fn(),
            resolveSpec: jest.fn(),
            resolveThermalProfile: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SectionAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(EtiquetadoController);
  });

  it("forwards create with tenant + session user", async () => {
    foodLabels.create.mockResolvedValue({ id: "fl1" });
    await controller.create(req, { labelType: "ELABORATED", recipeId: "r1" });
    expect(foodLabels.create).toHaveBeenCalledWith("t1", req.user, {
      labelType: "ELABORATED",
      recipeId: "r1",
    });
  });

  it("routes prep-context by recipeId / productId", async () => {
    await controller.prepContext(req, "r1", undefined);
    expect(context.forRecipe).toHaveBeenCalledWith("t1", "r1");
    await controller.prepContext(req, undefined, "p1");
    expect(context.forProduct).toHaveBeenCalledWith("t1", "p1");
  });

  it("searches products for the handled-article picker within the tenant", async () => {
    context.searchProducts.mockResolvedValue([{ id: "p1", name: "Tomate" }]);
    await expect(controller.productOptions(req, "tom")).resolves.toEqual([
      { id: "p1", name: "Tomate" },
    ]);
    expect(context.searchProducts).toHaveBeenCalledWith("t1", "tom");
  });

  // El buscador de la etiqueta no puede depender de la sección Artículos: un
  // rol con Artículos oculto debe seguir pudiendo emitir etiquetas.
  it("gates the product picker by label emission, not by the Artículos section", () => {
    const handler = EtiquetadoController.prototype.productOptions;
    expect(Reflect.getMetadata(SECTION_METADATA_KEY, handler)).toEqual([
      "etiquetado.emit",
    ]);
    expect(
      Reflect.getMetadata(SECTION_METADATA_KEY, EtiquetadoController),
    ).toEqual(["etiquetado"]);
  });

  it("rejects prep-context with neither id", async () => {
    await expect(
      controller.prepContext(req, undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
