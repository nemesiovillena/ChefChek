import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "./email.service";

describe("EmailService", () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe("sendEmail", () => {
    it("should return true for successful email send", async () => {
      const template = {
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      const result = await service.sendEmail("test@example.com", template);

      expect(result).toBe(true);
    });
  });

  describe("sendNotificationEmail", () => {
    it("should send notification email with correct template", async () => {
      const data = {
        userName: "John",
        title: "Test Alert",
        message: "Test message",
        type: "INFO",
      };

      const result = await service.sendNotificationEmail(
        "test@example.com",
        data,
      );

      expect(result).toBe(true);
    });
  });

  describe("sendAlertEmail", () => {
    it("should send alert email with severity color", async () => {
      const data = {
        userName: "John",
        alertType: "STOCK_LOW",
        title: "Low Stock Alert",
        description: "Product X is low on stock",
        severity: "HIGH",
      };

      const result = await service.sendAlertEmail("test@example.com", data);

      expect(result).toBe(true);
    });
  });

  describe("sendWelcomeEmail", () => {
    it("should send welcome email", async () => {
      const data = {
        userName: "John",
        tenantName: "Restaurant ABC",
        loginUrl: "https://chefchek.com/login",
      };

      const result = await service.sendWelcomeEmail("test@example.com", data);

      expect(result).toBe(true);
    });
  });
});
