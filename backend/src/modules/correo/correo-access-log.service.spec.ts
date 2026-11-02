import { CorreoAccessLogService } from "./correo-access-log.service";

describe("CorreoAccessLogService.openedEntityIds", () => {
  it("devuelve solo los correos abiertos del tenant, sin consultar si no hay ids", async () => {
    const findMany = jest.fn().mockResolvedValue([{ entityId: "INBOX:777:2" }]);
    const service = new CorreoAccessLogService({
      auditLog: { findMany },
    } as any);

    await expect(service.openedEntityIds("t1", [])).resolves.toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();

    const opened = await service.openedEntityIds("t1", [
      "INBOX:777:1",
      "INBOX:777:2",
    ]);
    expect([...opened]).toEqual(["INBOX:777:2"]);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "t1",
      action: "VIEW",
      entityType: "MailMessage",
      entityId: { in: ["INBOX:777:1", "INBOX:777:2"] },
    });
  });
});
