import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "../../common/services/prisma.service";
import {
  AssociateTelegramBotDto,
  AuthorizeTelegramUserDto,
} from "./dto/ingesta.dto";
import { Telegraf } from "telegraf";

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bots: Map<string, Telegraf> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log("TelegramBotService initialized");
    await this.loadActiveBots();
  }

  async onModuleDestroy() {
    this.logger.log("TelegramBotService destroyed");
    this.bots.forEach((bot) => bot.stop("Disconnecting"));
    this.bots.clear();
  }

  private async loadActiveBots() {
    const activeBots = await this.prisma.telegramBot.findMany({
      where: { isActive: true },
    });

    for (const bot of activeBots) {
      try {
        const telegrafBot = new Telegraf(bot.botToken);

        if (bot.webhookUrl) {
          await telegrafBot.telegram.setWebhook(bot.webhookUrl);
          this.logger.log(
            `Webhook set for tenant: ${bot.tenantId} -> ${bot.webhookUrl}`,
          );
        }

        this.bots.set(bot.tenantId, telegrafBot);
        this.logger.log(`Loaded Telegram bot for tenant: ${bot.tenantId}`);
      } catch (error) {
        this.logger.error(
          `Error loading bot for tenant ${bot.tenantId}: ${error.message}`,
        );
      }
    }
  }

  async associateBot(dto: AssociateTelegramBotDto) {
    this.logger.log(`Associating Telegram bot for tenant: ${dto.tenantId}`);

    try {
      const bot = await this.prisma.telegramBot.create({
        data: {
          tenantId: dto.tenantId,
          botToken: dto.botToken,
          webhookUrl: dto.webhookUrl,
          isActive: dto.isActive ?? true,
          environment: dto.environment || "development",
        },
      });

      if (dto.isActive !== false) {
        const telegrafBot = new Telegraf(dto.botToken);

        if (dto.webhookUrl) {
          await telegrafBot.telegram.setWebhook(dto.webhookUrl);
        }

        this.bots.set(dto.tenantId, telegrafBot);
      }

      return {
        success: true,
        data: bot,
        message: "Telegram bot associated successfully",
      };
    } catch (error) {
      this.logger.error(`Error associating Telegram bot: ${error.message}`);
      throw error;
    }
  }

  async handleWebhook(tenantId: string, webhookData: any) {
    this.logger.log(`Handling webhook for tenant: ${tenantId}`);

    const bot = this.bots.get(tenantId);

    if (!bot) {
      this.logger.warn(`No active bot found for tenant: ${tenantId}`);
      return {
        success: false,
        error: {
          code: "NO_BOT",
          message: "No active Telegram bot for this tenant",
        },
      };
    }

    try {
      bot.handleUpdate(webhookData);

      const message = webhookData.message;
      if (!message) {
        return { success: true, message: "Webhook processed (no message)" };
      }

      const chatId = message.chat.id;
      const userId = message.from.id;

      if (message.photo && message.photo.length > 0) {
        const photo = message.photo[message.photo.length - 1];
        const fileId = photo.file_id;

        this.logger.log(`Photo received from user ${userId} in chat ${chatId}`);
        return await this.handlePhotoUpload(tenantId, fileId, userId, chatId);
      } else if (message.document) {
        const fileId = message.document.file_id;
        const fileName = message.document.file_name || "unknown.pdf";

        this.logger.log(
          `Document received from user ${userId} in chat ${chatId}: ${fileName}`,
        );

        return await this.handleDocumentUpload(
          tenantId,
          fileId,
          fileName,
          userId,
          chatId,
        );
      } else if (message.text) {
        return await this.handleCommand(tenantId, message.text, userId, chatId);
      }

      return { success: true, message: "Webhook processed" };
    } catch (error) {
      this.logger.error(`Error handling webhook: ${error.message}`);
      throw error;
    }
  }

  private async handlePhotoUpload(
    tenantId: string,
    fileId: string,
    userId: string,
    chatId: string,
  ) {
    try {
      const bot = this.bots.get(tenantId);
      if (!bot) {
        throw new Error("No active bot configured for this tenant");
      }

      const fileUrl = await bot.telegram.getFileLink(fileId);

      return {
        success: true,
        data: {
          tenantId,
          documentType: "RECEIPT",
          fileUrl: fileUrl.href,
          fileId,
          source: "telegram",
          sourceUserId: String(userId),
          chatId,
        },
        message: "Photo upload processed",
      };
    } catch (error) {
      this.logger.error(`Error handling photo upload: ${error.message}`);
      throw error;
    }
  }

  private async handleDocumentUpload(
    tenantId: string,
    fileId: string,
    fileName: string,
    userId: string,
    chatId: string,
  ) {
    try {
      const bot = this.bots.get(tenantId);
      if (!bot) {
        throw new Error("No active bot configured for this tenant");
      }

      const fileUrl = await bot.telegram.getFileLink(fileId);

      let documentType = "INVOICE";
      if (fileName.toLowerCase().includes("pedido")) {
        documentType = "ORDER_CONFIRMATION";
      } else if (fileName.toLowerCase().includes("catálogo")) {
        documentType = "PRODUCT_CATALOG";
      } else if (fileName.toLowerCase().includes("nota")) {
        documentType = "DELIVERY_NOTE";
      }

      return {
        success: true,
        data: {
          tenantId,
          documentType,
          fileUrl: fileUrl.href,
          fileId,
          fileName,
          source: "telegram",
          sourceUserId: String(userId),
          chatId,
        },
        message: `Document upload processed as ${documentType}`,
      };
    } catch (error) {
      this.logger.error(`Error handling document upload: ${error.message}`);
      throw error;
    }
  }

  private async handleCommand(
    tenantId: string,
    text: string,
    userId: string,
    chatId: string,
  ) {
    const command = text.trim().toLowerCase();
    const bot = this.bots.get(tenantId);

    // Verificar si el usuario está autorizado
    const isAuthorized = await this.isUserAuthorized(
      tenantId,
      parseInt(userId),
    );
    if (!isAuthorized) {
      if (bot) {
        try {
          await bot.telegram.sendMessage(
            chatId,
            "🚫 No estás autorizado para usar este bot. Contacta al administrador del restaurante.",
          );
        } catch (error) {
          this.logger.error(`Error sending message: ${error.message}`);
        }
      }
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Usuario no autorizado",
        },
      };
    }

    let message = "";

    switch (command) {
      case "/start":
        message =
          "¡Hola! 👋 Bienvenido al bot de ingesta de ChefChek.\n" +
          "Envía facturas, pedidos o documentos para procesarlos automáticamente.";
        break;

      case "/ingest":
      case "/ingesto":
        message =
          "📄 Para procesar documentos, envíe fotos o archivos PDF de facturas, pedidos o catálogos de productos.";
        break;

      case "/status":
        message =
          "📊 Consulta el dashboard para ver el estado de procesamiento de documentos.";
        break;

      case "/help":
        message =
          "📖 Comandos disponibles:\n" +
          "/start - Iniciar sesión\n" +
          "/ingest - Información sobre ingesta de documentos\n" +
          "/status - Estado de procesamiento\n" +
          "/help - Esta ayuda";
        break;

      default:
        message =
          "❓ Comando no reconocido. Usa /help para ver comandos disponibles.";
    }

    if (bot) {
      try {
        await bot.telegram.sendMessage(chatId, message);
      } catch (error) {
        this.logger.error(`Error sending message: ${error.message}`);
      }
    }

    return {
      success: true,
      message,
    };
  }

  private async isUserAuthorized(
    tenantId: string,
    telegramUserId: number,
  ): Promise<boolean> {
    const bot = await this.prisma.telegramBot.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!bot) {
      return false;
    }

    const authorizedUser = await this.prisma.telegramUser.findFirst({
      where: {
        telegramBotId: bot.id,
        telegramUserId: BigInt(telegramUserId),
        isActive: true,
      },
    });

    return !!authorizedUser;
  }

  async authorizeUser(dto: AuthorizeTelegramUserDto) {
    this.logger.log(
      `Authorizing Telegram user ${dto.telegramUserId} for tenant ${dto.tenantId}`,
    );

    try {
      const bot = await this.prisma.telegramBot.findFirst({
        where: { tenantId: dto.tenantId, isActive: true },
      });

      if (!bot) {
        return {
          success: false,
          error: {
            code: "NO_BOT",
            message: "No active Telegram bot found for this tenant",
          },
        };
      }

      // Check if user already authorized
      const existingUser = await this.prisma.telegramUser.findFirst({
        where: {
          telegramBotId: bot.id,
          telegramUserId: BigInt(dto.telegramUserId),
        },
      });

      if (existingUser) {
        // Reactivate if inactive
        const updated = await this.prisma.telegramUser.update({
          where: { id: existingUser.id },
          data: { isActive: true },
        });

        return {
          success: true,
          data: updated,
          message: "Telegram user reactivated",
        };
      }

      // Create new authorization
      const telegramUser = await this.prisma.telegramUser.create({
        data: {
          tenantId: dto.tenantId,
          telegramBotId: bot.id,
          telegramUserId: BigInt(dto.telegramUserId),
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          userId: dto.userId,
          isActive: true,
        },
      });

      return {
        success: true,
        data: telegramUser,
        message: "Telegram user authorized successfully",
      };
    } catch (error) {
      this.logger.error(`Error authorizing Telegram user: ${error.message}`);
      throw error;
    }
  }

  async getAuthorizedUsers(tenantId: string) {
    const bot = await this.prisma.telegramBot.findFirst({
      where: { tenantId: tenantId, isActive: true },
    });

    if (!bot) {
      return {
        success: true,
        data: [],
        count: 0,
      };
    }

    const users = await this.prisma.telegramUser.findMany({
      where: { telegramBotId: bot.id, isActive: true },
      include: { user: true },
    });

    return {
      success: true,
      data: users,
      count: users.length,
    };
  }

  async revokeUser(userId: string) {
    const updated = await this.prisma.telegramUser.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return {
      success: true,
      data: updated,
      message: "Telegram user revoked",
    };
  }

  private async getTelegramFileUrl(
    tenantId: string,
    fileId: string,
  ): Promise<string> {
    const bot = this.bots.get(tenantId);

    if (!bot) {
      throw new Error("No active bot configured for this tenant");
    }

    const fileUrl = await bot.telegram.getFileLink(fileId);
    return fileUrl.href;
  }

  async sendMessage(tenantId: string, chatId: string, message: string) {
    const bot = this.bots.get(tenantId);

    if (!bot) {
      this.logger.warn(`No active bot for tenant: ${tenantId}`);
      return;
    }

    this.logger.log(`Sending message to chat ${chatId}: ${message}`);

    try {
      await bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }

  async getBotByTenant(tenantId: string) {
    return this.bots.get(tenantId) || null;
  }

  async getActiveBots() {
    const bots = await this.prisma.telegramBot.findMany({
      where: { isActive: true },
    });

    return {
      success: true,
      data: bots,
      count: bots.length,
    };
  }

  async updateBot(tenantId: string, isActive: boolean) {
    const updated = await this.prisma.telegramBot.updateMany({
      where: { tenantId },
      data: { isActive },
    });

    if (isActive) {
      await this.loadActiveBots();
    } else {
      const bot = this.bots.get(tenantId);
      if (bot) {
        bot.stop();
        this.bots.delete(tenantId);
      }
    }

    return {
      success: true,
      message: `Bot ${isActive ? "activated" : "deactivated"} for tenant ${tenantId}`,
    };
  }
}
