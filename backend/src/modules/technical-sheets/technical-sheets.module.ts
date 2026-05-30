import { Module } from '@nestjs/common';
import { TechnicalSheetsService } from './technical-sheets.service';
import { TechnicalSheetsController } from './technical-sheets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TechnicalSheetsController],
  providers: [TechnicalSheetsService],
  exports: [TechnicalSheetsService],
})
export class TechnicalSheetsModule {}