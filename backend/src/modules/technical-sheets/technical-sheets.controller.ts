import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards, Res, Header } from '@nestjs/common';
import { TechnicalSheetsService } from './technical-sheets.service';
import { CreateTemplateDto, UpdateTemplateDto, GenerateSheetDto, GenerateBatchDto } from './dto/technical-sheets.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/technical-sheets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TechnicalSheetsController {
  constructor(private readonly technicalSheetsService: TechnicalSheetsService) {}

  @Post('templates')
  @Roles('ADMIN', 'USER')
  async createTemplate(@Req() req, @Body() dto: CreateTemplateDto) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const userId = req.user?.id;
    const result = await this.technicalSheetsService.createTemplate(tenantId, userId, dto);
    return result;
  }

  @Get('templates')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getTemplates(@Req() req) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const templates = await this.technicalSheetsService.getTemplates(tenantId);
    return {
      success: true,
      data: templates,
    };
  }

  @Get('templates/:templateId')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getTemplate(@Param('templateId') templateId: string) {
    const template = await this.technicalSheetsService.getTemplate(templateId);
    return {
      success: true,
      data: template,
    };
  }

  @Put('templates/:templateId')
  @Roles('ADMIN', 'USER')
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateTemplateDto
  ) {
    const result = await this.technicalSheetsService.updateTemplate(templateId, dto);
    return result;
  }

  @Delete('templates/:templateId')
  @Roles('ADMIN')
  async deleteTemplate(@Param('templateId') templateId: string) {
    const result = await this.technicalSheetsService.deleteTemplate(templateId);
    return result;
  }

  @Post('generate')
  @Roles('ADMIN', 'USER')
  async generateTechnicalSheet(
    @Req() req,
    @Body() dto: GenerateSheetDto,
    @Res() res
  ) {
    try {
      const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
      const userId = req.user?.id;

      const pdfBuffer = await this.technicalSheetsService.generateTechnicalSheet(
        tenantId,
        userId,
        dto
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ficha-tecnica-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  @Post('generate-batch')
  @Roles('ADMIN', 'USER')
  async generateBatch(
    @Req() req,
    @Body() dto: GenerateBatchDto,
    @Res() res
  ) {
    try {
      const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
      const userId = req.user?.id;

      const pdfBuffer = await this.technicalSheetsService.generateBatch(
        tenantId,
        userId,
        dto
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fichas-tecnicas-${Date.now()}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  @Get('documents')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getDocuments(@Req() req, @Body() filters?: any) {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const documents = await this.technicalSheetsService.getDocuments(tenantId, filters);
    return {
      success: true,
      data: documents,
    };
  }

  @Get('documents/:documentId')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async getDocument(@Param('documentId') documentId: string) {
    const document = await this.technicalSheetsService.getDocument(documentId);
    return {
      success: true,
      data: document,
    };
  }

  @Delete('documents/:documentId')
  @Roles('ADMIN')
  async deleteDocument(@Param('documentId') documentId: string) {
    const result = await this.technicalSheetsService.deleteDocument(documentId);
    return result;
  }

  @Post('preview')
  @Roles('ADMIN', 'USER', 'VIEWER')
  async previewTechnicalSheet(
    @Req() req,
    @Body() dto: GenerateSheetDto
  ): Promise<any> {
    const tenantId = req.tenant?.id || req.headers['x-tenant-slug'];
    const userId = req.user?.id;

    const pdfBuffer = await this.technicalSheetsService.generateTechnicalSheet(
      tenantId,
      userId,
      dto
    );

    const base64 = pdfBuffer.toString('base64');

    return {
      success: true,
      data: {
        base64,
        format: 'pdf',
        size: pdfBuffer.length,
      },
    };
  }
}