import { HEAVY_REQUEST_RETRY_DELAYS_MS } from "../../ai-assistant/providers/provider-http.util";
import {
  AgreementExtractionError,
  AgreementExtractionService,
  parseAgreementExtraction,
} from "./agreement-extraction.service";

describe("parseAgreementExtraction", () => {
  it("devuelve los parámetros válidos con su cita", () => {
    const result = parseAgreementExtraction(
      JSON.stringify({
        isAgreement: true,
        agreementName: "Convenio de Hostelería de Alicante",
        annualHours: { value: 1792, source: "Art. 20, pág. 8" },
        weeklyHours: { value: 40, source: "Art. 20" },
        weeklyRestDays: { value: 2, source: "Art. 22" },
        nightStart: { value: "22:00", source: "Art. 25" },
        nightEnd: { value: "6:00", source: "Art. 25" },
        vacationDays: { value: 31, source: "Art. 30" },
        vacationDayType: { value: "NATURAL", source: "Art. 30" },
        overtimeYearlyCap: { value: null, source: null },
      }),
    );

    expect(result.agreementName).toBe("Convenio de Hostelería de Alicante");
    expect(result.fields).toEqual({
      annualHours: { value: 1792, source: "Art. 20, pág. 8" },
      weeklyHours: { value: 40, source: "Art. 20" },
      weeklyRestDays: { value: 2, source: "Art. 22" },
      nightStart: { value: "22:00", source: "Art. 25" },
      nightEnd: { value: "06:00", source: "Art. 25" },
      vacationDays: { value: 31, source: "Art. 30" },
      vacationDayType: { value: "NATURAL", source: "Art. 30" },
    });
  });

  it("omite lo que no aparece o queda fuera de rango", () => {
    const result = parseAgreementExtraction(
      JSON.stringify({
        annualHours: { value: 99999, source: "x" },
        maxDailyHours: { value: 9, source: "Art. 21" },
        vacationDays: { value: 30.5, source: "x" },
        vacationDayType: { value: "LABORABLES", source: "x" },
        nightStart: { value: "25:00", source: "x" },
      }),
    );

    expect(result.fields).toEqual({
      maxDailyHours: { value: 9, source: "Art. 21" },
    });
  });

  it("entiende números en texto con formato español", () => {
    const result = parseAgreementExtraction(
      JSON.stringify({
        annualHours: { value: "1.792", source: null },
        weeklyRestDays: { value: "1,5", source: null },
      }),
    );

    expect(result.fields.annualHours?.value).toBe(1792);
    expect(result.fields.weeklyRestDays?.value).toBe(1.5);
  });

  it("tolera texto alrededor del JSON", () => {
    const result = parseAgreementExtraction(
      'Aquí está:\n```json\n{"weeklyHours": {"value": 40, "source": "Art. 5"}}\n```',
    );

    expect(result.fields.weeklyHours?.value).toBe(40);
  });

  it("combina una lista con un objeto por documento: gana el primer valor válido", () => {
    const result = parseAgreementExtraction(
      JSON.stringify([
        {
          isAgreement: true,
          agreementName: "Convenio de Hostelería de Alicante",
          annualHours: { value: 1796.63, source: "Art. 21" },
          minRestBetweenShiftsHours: { value: null, source: null },
        },
        {
          isAgreement: true,
          agreementName: "VI Acuerdo Laboral de Hostelería",
          annualHours: { value: 1826, source: "Art. 9" },
          minRestBetweenShiftsHours: { value: 12, source: "Art. 10" },
        },
        { isAgreement: false },
      ]),
    );

    expect(result.agreementName).toBe("Convenio de Hostelería de Alicante");
    expect(result.fields).toEqual({
      annualHours: { value: 1796.63, source: "Art. 21" },
      minRestBetweenShiftsHours: { value: 12, source: "Art. 10" },
    });
  });

  it("lee una lista aunque venga con texto alrededor", () => {
    const result = parseAgreementExtraction(
      '```json\n[{"weeklyHours": {"value": 40, "source": "Art. 5"}}, {"vacationDays": {"value": 31, "source": "Art. 7"}}]\n```',
    );

    expect(result.fields.weeklyHours?.value).toBe(40);
    expect(result.fields.vacationDays?.value).toBe(31);
  });

  it.each([
    ["sin JSON", "no puedo leerlo"],
    ["JSON roto", "{ weeklyHours: "],
    ["no es un convenio", '{"isAgreement": false}'],
    ["ningún parámetro", '{"isAgreement": true, "agreementName": "X"}'],
  ])("rechaza %s", (_label, raw) => {
    expect(() => parseAgreementExtraction(raw)).toThrow(
      AgreementExtractionError,
    );
  });
});

describe("AgreementExtractionService", () => {
  const attachment = { mimeType: "application/pdf", dataBase64: "AAAA" };

  function build(result: { content?: string; truncated?: boolean }) {
    const completion = {
      assertConfigured: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn().mockResolvedValue(result),
    };
    const service = new AgreementExtractionService(completion as any);
    return { service, completion };
  }

  it("manda los adjuntos a la IA del tenant sin reintentos", async () => {
    const { service, completion } = build({
      content: '{"weeklyHours": {"value": 40, "source": "Art. 5"}}',
    });

    const result = await service.extract("tenant-1", [attachment]);

    expect(result.fields.weeklyHours?.value).toBe(40);
    expect(completion.assertConfigured).toHaveBeenCalledWith("tenant-1");
    const [tenantId, messages, options] = completion.complete.mock.calls[0];
    expect(tenantId).toBe("tenant-1");
    expect(messages[1].attachments).toEqual([attachment]);
    expect(options).toMatchObject({
      jsonMode: true,
      retryDelaysMs: HEAVY_REQUEST_RETRY_DELAYS_MS,
    });
  });

  it("avisa si la respuesta llega cortada", async () => {
    const { service } = build({ content: "{", truncated: true });

    await expect(service.extract("tenant-1", [attachment])).rejects.toThrow(
      AgreementExtractionError,
    );
  });
});
