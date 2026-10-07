import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  CuinerConfigService,
  hashConnectorToken,
} from "./cuiner-config.service";
import { CuinerSalesService } from "./cuiner-sales.service";
import { CuinerConnectorGuard } from "./guards/cuiner-connector.guard";

const storedConfig = {
  id: "c1",
  tenantId: "t1",
  enabled: true,
  mode: "DRY_RUN",
  empresa: "01",
  centro: "02",
  almacen: "01",
  actUsuario: null,
  warehouseId: null,
  connectorTokenHash: "hash",
  lastVentasCabId: 0,
};

function makePrisma(existing: unknown = storedConfig) {
  return {
    warehouse: { findFirst: jest.fn(async () => null) },
    cuinerConfig: {
      findUnique: jest.fn(async () => existing),
      findUniqueOrThrow: jest.fn(async () => ({ lastVentasCabId: 3341487 })),
      findFirst: jest.fn(async () => existing),
      update: jest.fn(async (args: { data: object }) => ({
        ...storedConfig,
        ...args.data,
      })),
      create: jest.fn(async (args: { data: object }) => ({
        ...storedConfig,
        ...args.data,
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    cuinerSaleLine: {
      createMany: jest.fn(async (_args: unknown) => ({ count: 2 })),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe("CuinerConfigService", () => {
  it("nunca devuelve el hash del token", async () => {
    const service = new CuinerConfigService(
      makePrisma() as unknown as PrismaService,
    );
    const config = await service.getConfig("t1");
    expect(config).not.toHaveProperty("connectorTokenHash");
    expect(config?.hasConnectorToken).toBe(true);
  });

  it("exige el usuario de Cuiner para pasar a modo real", async () => {
    const service = new CuinerConfigService(
      makePrisma() as unknown as PrismaService,
    );
    await expect(
      service.updateConfig("t1", { mode: "LIVE" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exige el centro al crear la configuración", async () => {
    const service = new CuinerConfigService(
      makePrisma(null) as unknown as PrismaService,
    );
    await expect(
      service.updateConfig("t1", { enabled: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un almacén de otro tenant", async () => {
    const service = new CuinerConfigService(
      makePrisma() as unknown as PrismaService,
    );
    await expect(
      service.updateConfig("t1", { warehouseId: "w9" }),
    ).rejects.toThrow("Almacén no encontrado");
  });

  it("guarda solo el sha256 del token generado", async () => {
    const prisma = makePrisma();
    const service = new CuinerConfigService(prisma as unknown as PrismaService);
    const { token } = await service.regenerateConnectorToken("t1");
    expect(token).toMatch(/^ckc_/);
    expect(prisma.cuinerConfig.update).toHaveBeenCalledWith({
      where: { tenantId: "t1" },
      data: { connectorTokenHash: hashConnectorToken(token) },
    });
  });

  it("solo coloca el cursor de ventas si sigue en 0", async () => {
    const prisma = makePrisma();
    const service = new CuinerConfigService(prisma as unknown as PrismaService);
    await service.bootstrapSalesCursor("t1", 3341487);
    expect(prisma.cuinerConfig.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", lastVentasCabId: 0 },
      data: { lastVentasCabId: 3341487 },
    });
  });
});

describe("CuinerSalesService.ingest", () => {
  it("inserta sin duplicar, ignora anuladas y el cursor solo avanza", async () => {
    const prisma = makePrisma();
    const service = new CuinerSalesService(prisma as unknown as PrismaService);
    const result = await service.ingest("t1", {
      cursor: 3341487,
      lines: [
        {
          idVentasCab: 3341487,
          linea: 0,
          fecha: "2026-10-03",
          tipo: "P",
          producto: "00967",
          unidades: 1,
          anulada: false,
        },
        {
          idVentasCab: 3341487,
          linea: 1,
          fecha: "2026-10-03",
          tipo: "P",
          producto: "01001",
          unidades: 1,
          anulada: true,
        },
      ],
    });

    const { data, skipDuplicates } = prisma.cuinerSaleLine.createMany.mock
      .calls[0][0] as {
      data: { status: string }[];
      skipDuplicates: boolean;
    };
    expect(skipDuplicates).toBe(true);
    expect(data.map((d) => d.status)).toEqual(["PENDIENTE", "IGNORADA"]);
    expect(prisma.cuinerConfig.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", lastVentasCabId: { lt: 3341487 } },
      data: { lastVentasCabId: 3341487 },
    });
    expect(result).toEqual({
      received: 2,
      inserted: 2,
      lastVentasCabId: 3341487,
    });
  });
});

describe("CuinerConnectorGuard", () => {
  const context = (headers: Record<string, string>) => {
    const request: Record<string, unknown> = { headers };
    return {
      request,
      ctx: { switchToHttp: () => ({ getRequest: () => request }) } as never,
    };
  };

  it("rechaza peticiones sin token válido", async () => {
    const configService = {
      findByConnectorToken: jest.fn(async () => null),
      touchLastSeen: jest.fn(),
    };
    const guard = new CuinerConnectorGuard(
      configService as unknown as CuinerConfigService,
    );
    await expect(guard.canActivate(context({}).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(configService.touchLastSeen).not.toHaveBeenCalled();
  });

  it("resuelve el tenant desde el token y marca la última conexión", async () => {
    const configService = {
      findByConnectorToken: jest.fn(async () => storedConfig),
      touchLastSeen: jest.fn(async () => undefined),
    };
    const guard = new CuinerConnectorGuard(
      configService as unknown as CuinerConfigService,
    );
    const { request, ctx } = context({ "x-connector-token": "ckc_x" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.tenantId).toBe("t1");
    expect(configService.findByConnectorToken).toHaveBeenCalledWith("ckc_x");
    expect(configService.touchLastSeen).toHaveBeenCalledWith("t1");
  });
});
