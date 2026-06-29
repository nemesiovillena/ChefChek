import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AlbaranesController } from "./albaranes.controller";
import { AlbaranesService } from "./albaranes.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";

describe("AlbaranesController", () => {
  let controller: AlbaranesController;

  const mockService = {
    create: jest.fn(),
    createFromUpload: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updateLine: jest.fn(),
    addLine: jest.fn(),
    matchLine: jest.fn(),
    setLineStatus: jest.fn(),
    remove: jest.fn(),
  };

  const mockReq = { user: { tenantId: "t1" }, body: {} };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbaranesController],
      providers: [{ provide: AlbaranesService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlbaranesController>(AlbaranesController);
  });

  afterEach(() => jest.clearAllMocks());

  it("create delegates to service with tenantId", async () => {
    mockService.create.mockResolvedValue({ id: "a" });
    const dto = { lines: [] };
    await controller.create(dto as any, mockReq);
    expect(mockService.create).toHaveBeenCalledWith(dto, "t1");
  });

  describe("createFromUpload", () => {
    it("throws BadRequest when no files uploaded", async () => {
      await expect(controller.createFromUpload([], mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequest when files is undefined", async () => {
      await expect(
        controller.createFromUpload(undefined as any, mockReq),
      ).rejects.toThrow(BadRequestException);
    });

    it("delegates to service and maps lines to products with supplier name", async () => {
      const albaranResult = {
        supplier: { name: "Prov SL" },
        lines: [
          {
            description: "Tomate",
            quantity: 2,
            unit: "kg",
            unitPrice: 3,
            confidence: 0.9,
          },
        ],
      };
      mockService.createFromUpload.mockResolvedValue(albaranResult);
      const req = { ...mockReq, body: { ai_model: "gpt", ai_api_key: "k" } };

      const res = await controller.createFromUpload(
        [{ originalname: "a.pdf" }] as any,
        req,
      );

      expect(mockService.createFromUpload).toHaveBeenCalledWith(
        [{ originalname: "a.pdf" }],
        "t1",
        "gpt",
        "k",
      );
      expect(res.albaran).toEqual(albaranResult);
      expect(res.products[0]).toMatchObject({
        name: "Tomate",
        supplier: "Prov SL",
        quantity: 2,
        total_price: 6,
      });
    });

    it("defaults supplier to IMPORTADO and confidence to 0.7", async () => {
      mockService.createFromUpload.mockResolvedValue({
        lines: [{ description: "x", quantity: 1, unitPrice: 2 }],
        supplier: undefined,
      });

      const res = await controller.createFromUpload(
        [{ originalname: "a.pdf" }] as any,
        mockReq,
      );

      expect(res.products[0].supplier).toBe("IMPORTADO");
      expect(res.products[0].confidence).toBe(0.7);
    });

    it("returns empty products when albaran has no lines", async () => {
      mockService.createFromUpload.mockResolvedValue({ lines: undefined });

      const res = await controller.createFromUpload(
        [{ originalname: "a.pdf" }] as any,
        mockReq,
      );

      expect(res.products).toEqual([]);
    });
  });

  it("findAll delegates with query and tenantId", async () => {
    mockService.findAll.mockResolvedValue({ data: [], meta: {} });
    const query = { page: 1 };
    await controller.findAll(query as any, mockReq);
    expect(mockService.findAll).toHaveBeenCalledWith(query, "t1");
  });

  it("addLine delegates", async () => {
    mockService.addLine.mockResolvedValue({ success: true });
    const dto = { description: "x" };
    await controller.addLine("alb-1", dto as any, mockReq);
    expect(mockService.addLine).toHaveBeenCalledWith("alb-1", dto, "t1");
  });

  it("findOne delegates", async () => {
    mockService.findOne.mockResolvedValue({ id: "alb-1" });
    await controller.findOne("alb-1", mockReq);
    expect(mockService.findOne).toHaveBeenCalledWith("alb-1", "t1");
  });

  it("update delegates", async () => {
    mockService.update.mockResolvedValue({ id: "alb-1" });
    const dto = { notes: "n" };
    await controller.update("alb-1", dto as any, mockReq);
    expect(mockService.update).toHaveBeenCalledWith("alb-1", dto, "t1");
  });

  it("updateStatus delegates with dto.status", async () => {
    mockService.updateStatus.mockResolvedValue({ id: "alb-1" });
    await controller.updateStatus(
      "alb-1",
      { status: "REVISADO" } as any,
      mockReq,
    );
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      "alb-1",
      "REVISADO",
      "t1",
    );
  });

  it("updateLine delegates", async () => {
    mockService.updateLine.mockResolvedValue({ id: "l1" });
    const dto = { quantity: "2" };
    await controller.updateLine("alb-1", "l1", dto as any, mockReq);
    expect(mockService.updateLine).toHaveBeenCalledWith(
      "alb-1",
      "l1",
      dto,
      "t1",
    );
  });

  it("matchLine delegates with productId", async () => {
    mockService.matchLine.mockResolvedValue({ id: "l1" });
    await controller.matchLine(
      "alb-1",
      "l1",
      { productId: "p1" } as any,
      mockReq,
    );
    expect(mockService.matchLine).toHaveBeenCalledWith(
      "alb-1",
      "l1",
      "p1",
      "t1",
    );
  });

  it("confirmLine delegates with CONFIRMADO status", async () => {
    mockService.setLineStatus.mockResolvedValue({ id: "l1" });
    await controller.confirmLine("alb-1", "l1", mockReq);
    expect(mockService.setLineStatus).toHaveBeenCalledWith(
      "alb-1",
      "l1",
      "CONFIRMADO",
      "t1",
    );
  });

  it("rejectLine delegates with RECHAZADO status", async () => {
    mockService.setLineStatus.mockResolvedValue({ id: "l1" });
    await controller.rejectLine("alb-1", "l1", mockReq);
    expect(mockService.setLineStatus).toHaveBeenCalledWith(
      "alb-1",
      "l1",
      "RECHAZADO",
      "t1",
    );
  });

  it("remove delegates", async () => {
    mockService.remove.mockResolvedValue({ id: "alb-1" });
    await controller.remove("alb-1", mockReq);
    expect(mockService.remove).toHaveBeenCalledWith("alb-1", "t1");
  });
});
