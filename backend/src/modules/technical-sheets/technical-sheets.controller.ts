import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  Res,
} from "@nestjs/common";
import { TechnicalSheetsService } from "./technical-sheets.service";
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  GenerateSheetDto,
  GenerateBatchDto,
} from "./dto/technical-sheets.dto";
import { AuthGuard } from "../../guards/auth.guard";
import { TenantGuard } from "../../guards/tenant.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { ModuleGuard, RequireModule } from "../../guards/module.guard";
import { Roles } from "../../decorators/roles.decorator";

@Controller("api/v1/technical-sheets")
@UseGuards(AuthGuard, TenantGuard, RolesGuard, ModuleGuard)
@RequireModule("technical-sheets")
export class TechnicalSheetsController {
  constructor(
    private readonly technicalSheetsService: TechnicalSheetsService,
  ) {}

  @Post("templates")
  @Roles("ADMIN", "USER")
  async createTemplate(@Req() req: any, @Body() dto: CreateTemplateDto) {
    const tenantId = req.tenantId;
    const userId = req.user?.id;
    const result = await this.technicalSheetsService.createTemplate(
      tenantId,
      userId,
      dto,
    );
    return result;
  }

  @Get("templates")
  @Roles("ADMIN", "USER", "VIEWER")
  async getTemplates(@Req() req: any) {
    const tenantId = req.tenantId;
    const templates = await this.technicalSheetsService.getTemplates(tenantId);
    return {
      success: true,
      data: templates,
    };
  }

  @Get("templates/:templateId")
  @Roles("ADMIN", "USER", "VIEWER")
  async getTemplate(@Req() req: any, @Param("templateId") templateId: string) {
    const tenantId = req.tenantId;
    const template = await this.technicalSheetsService.getTemplate(
      tenantId,
      templateId,
    );
    return {
      success: true,
      data: template,
    };
  }

  @Put("templates/:templateId")
  @Roles("ADMIN", "USER")
  async updateTemplate(
    @Req() req: any,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const tenantId = req.tenantId;
    const result = await this.technicalSheetsService.updateTemplate(
      tenantId,
      templateId,
      dto,
    );
    return result;
  }

  @Delete("templates/:templateId")
  @Roles("ADMIN")
  async deleteTemplate(
    @Req() req: any,
    @Param("templateId") templateId: string,
  ) {
    const tenantId = req.tenantId;
    const result = await this.technicalSheetsService.deleteTemplate(
      tenantId,
      templateId,
    );
    return result;
  }

  @Post("generate")
  @Roles("ADMIN", "USER")
  async generateTechnicalSheet(
    @Req() req: any,
    @Body() dto: GenerateSheetDto,
    @Res() res,
  ) {
    try {
      const tenantId = req.tenantId;
      const userId = req.user?.id;

      const pdfBuffer =
        await this.technicalSheetsService.generateTechnicalSheet(
          tenantId,
          userId,
          dto,
        );

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ficha-tecnica-${Date.now()}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  @Post("generate-batch")
  @Roles("ADMIN", "USER")
  async generateBatch(
    @Req() req: any,
    @Body() dto: GenerateBatchDto,
    @Res() res,
  ) {
    try {
      const tenantId = req.tenantId;
      const userId = req.user?.id;

      const pdfBuffer = await this.technicalSheetsService.generateBatch(
        tenantId,
        userId,
        dto,
      );

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fichas-tecnicas-${Date.now()}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  @Get("documents")
  @Roles("ADMIN", "USER", "VIEWER")
  async getDocuments(@Req() req: any, @Body() filters?: any) {
    const tenantId = req.tenantId;
    const documents = await this.technicalSheetsService.getDocuments(
      tenantId,
      filters,
    );
    return {
      success: true,
      data: documents,
    };
  }

  @Get("documents/:documentId")
  @Roles("ADMIN", "USER", "VIEWER")
  async getDocument(@Req() req: any, @Param("documentId") documentId: string) {
    const tenantId = req.tenantId;
    const document = await this.technicalSheetsService.getDocument(
      tenantId,
      documentId,
    );
    return {
      success: true,
      data: document,
    };
  }

  @Delete("documents/:documentId")
  @Roles("ADMIN")
  async deleteDocument(
    @Req() req: any,
    @Param("documentId") documentId: string,
  ) {
    const tenantId = req.tenantId;
    const result = await this.technicalSheetsService.deleteDocument(
      tenantId,
      documentId,
    );
    return result;
  }

  @Post("preview")
  @Roles("ADMIN", "USER", "VIEWER")
  async previewTechnicalSheet(
    @Req() req: any,
    @Body() dto: GenerateSheetDto,
  ): Promise<any> {
    const tenantId = req.tenantId;
    const userId = req.user?.id;

    const pdfBuffer = await this.technicalSheetsService.generateTechnicalSheet(
      tenantId,
      userId,
      dto,
    );

    const base64 = pdfBuffer.toString("base64");

    return {
      success: true,
      data: {
        base64,
        format: "pdf",
        size: pdfBuffer.length,
      },
    };
  }
}
