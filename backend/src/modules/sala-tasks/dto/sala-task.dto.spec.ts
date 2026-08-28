import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateSalaTaskDto, UpdateSalaTaskDto } from "./sala-task.dto";

/**
 * El formulario del modal (frontend) inicializa los campos de texto
 * opcionales en '' cuando el usuario no los rellena (título/fecha son los
 * únicos obligatorios). @IsOptional() de class-validator solo omite la
 * validación si el valor es undefined/null, no si es '' — sin el
 * @Transform(emptyStringAsUndefined) del DTO, crear una notificación sin
 * rellenar el email devolvía 400 "customerEmail must be an email".
 */
describe("DTOs de sala-tasks con el ValidationPipe real", () => {
  const makePipe = () =>
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

  const transform = (dto: unknown, payload: unknown) =>
    makePipe().transform(payload, {
      type: "body",
      metatype: dto as new () => unknown,
    });

  describe("CreateSalaTaskDto", () => {
    it("acepta campos opcionales de texto vacíos (formulario sin rellenar)", async () => {
      const result = (await transform(CreateSalaTaskDto, {
        title: "Reserva",
        eventDate: "2026-09-15",
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        menuNotes: "",
        observations: "",
        allergies: "",
      })) as CreateSalaTaskDto;

      expect(result.customerEmail).toBeUndefined();
      expect(result.customerName).toBeUndefined();
      expect(result.customerPhone).toBeUndefined();
      expect(result.menuNotes).toBeUndefined();
      expect(result.observations).toBeUndefined();
      expect(result.allergies).toBeUndefined();
    });

    it("sigue rechazando un email inválido de verdad", async () => {
      await expect(
        transform(CreateSalaTaskDto, {
          title: "Reserva",
          eventDate: "2026-09-15",
          customerEmail: "no-es-un-email",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("acepta un email válido", async () => {
      const result = (await transform(CreateSalaTaskDto, {
        title: "Reserva",
        eventDate: "2026-09-15",
        customerEmail: "cliente@example.com",
      })) as CreateSalaTaskDto;

      expect(result.customerEmail).toBe("cliente@example.com");
    });
  });

  describe("UpdateSalaTaskDto", () => {
    it("acepta campos opcionales de texto vacíos igual que en creación", async () => {
      const result = (await transform(UpdateSalaTaskDto, {
        customerEmail: "",
        allergies: "",
      })) as UpdateSalaTaskDto;

      expect(result.customerEmail).toBeUndefined();
      expect(result.allergies).toBeUndefined();
    });
  });
});
