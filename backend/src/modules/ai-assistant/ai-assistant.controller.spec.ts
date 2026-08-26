import { Test } from "@nestjs/testing";
import { AiAssistantController } from "./ai-assistant.controller";
import { AiAssistantService } from "./ai-assistant.service";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { ModuleGuard } from "../../guards/module.guard";
import { RolesGuard } from "../../guards/roles.guard";

describe("AiAssistantController", () => {
  let controller: AiAssistantController;
  let serviceMock: any;

  beforeEach(async () => {
    serviceMock = {
      ask: jest.fn().mockResolvedValue({ conversationId: "c1", answer: "ok" }),
      listConversations: jest.fn().mockResolvedValue([]),
      getConversation: jest.fn().mockResolvedValue({ id: "c1", messages: [] }),
    };
    const module = await Test.createTestingModule({
      controllers: [AiAssistantController],
      providers: [{ provide: AiAssistantService, useValue: serviceMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ModuleGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AiAssistantController);
  });

  it("ask: pasa tenantId/userId del request al servicio, nunca del body", async () => {
    const req = { tenantId: "t1", user: { id: "u1" } };
    await controller.ask(req, { message: "hola", conversationId: undefined });
    expect(serviceMock.ask).toHaveBeenCalledWith("t1", "u1", undefined, "hola");
  });

  it("listConversations: scoped a tenantId/userId del request", async () => {
    const req = { tenantId: "t1", user: { id: "u1" } };
    await controller.listConversations(req);
    expect(serviceMock.listConversations).toHaveBeenCalledWith("t1", "u1");
  });

  it("getConversation: scoped a tenantId/userId del request, id de la URL", async () => {
    const req = { tenantId: "t1", user: { id: "u1" } };
    await controller.getConversation(req, "c1");
    expect(serviceMock.getConversation).toHaveBeenCalledWith("t1", "u1", "c1");
  });
});
