import { BadRequestException, ValidationPipe } from "@nestjs/common";
import {
  CorrectAlbaranLinePriceDto,
  UpdateAlbaranLineDto,
} from "./update-albaran.dto";

/**
 * El frontend serializa los importes como números JSON y el ValidationPipe
 * global no tiene enableImplicitConversion: sin el @Transform(numberAsString)
 * del DTO, cualquier corrección de precio devolvía 400
 * "unitPrice must be a string". Estos specs usan el pipe real de main.ts.
 */
describe("DTOs de albaranes con el ValidationPipe real", () => {
  const makePipe = () =>
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

  const transform = (dto, payload) =>
    makePipe().transform(payload, { type: "body", metatype: dto });

  describe("CorrectAlbaranLinePriceDto", () => {
    it("acepta el payload del diálogo (números) y los normaliza a string", async () => {
      const dto = await transform(CorrectAlbaranLinePriceDto, {
        unitPrice: 12.5,
        totalPrice: 125.92,
      });
      expect(dto.unitPrice).toBe("12.5");
      expect(dto.totalPrice).toBe("125.92");
    });

    it("acepta strings y sigue validando el contenido", async () => {
      const dto = await transform(CorrectAlbaranLinePriceDto, {
        unitPrice: "12,5".replace(",", "."),
        totalPrice: "125.92",
      });
      expect(dto.unitPrice).toBe("12.5");
    });

    it("acepta totalPrice null (limpiar el neto) y ausente (conservarlo)", async () => {
      const withNull = await transform(CorrectAlbaranLinePriceDto, {
        unitPrice: 12.5,
        totalPrice: null,
      });
      expect(withNull.totalPrice).toBeNull();

      const withoutNet = await transform(CorrectAlbaranLinePriceDto, {
        unitPrice: "12.5",
      });
      expect(withoutNet.totalPrice).toBeUndefined();
    });

    it("rechaza valores que no son número ni string", async () => {
      await expect(
        transform(CorrectAlbaranLinePriceDto, { unitPrice: true }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        transform(CorrectAlbaranLinePriceDto, { unitPrice: { euro: 12 } }),
      ).rejects.toThrow(BadRequestException);

      await expect(transform(CorrectAlbaranLinePriceDto, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("UpdateAlbaranLineDto", () => {
    it("acepta la edición inline de cantidades y precios como números", async () => {
      const dto = await transform(UpdateAlbaranLineDto, {
        quantity: 3,
        unitPrice: 5.2,
        vatPercent: 10,
        priceWithVat: 5.72,
      });
      expect(dto.quantity).toBe("3");
      expect(dto.unitPrice).toBe("5.2");
      expect(dto.vatPercent).toBe("10");
      expect(dto.priceWithVat).toBe("5.72");
    });

    it("sigue aceptando strings (formato clásico del módulo)", async () => {
      const dto = await transform(UpdateAlbaranLineDto, { quantity: "3" });
      expect(dto.quantity).toBe("3");
    });
  });
});
