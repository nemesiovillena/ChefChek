import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BackupController } from "./backup.controller";
import { SuperadminBackupController } from "./superadmin-backup.controller";
import { BackupService } from "./backup.service";
import { BackupExportService } from "./backup-export.service";
import { BackupRestoreService } from "./backup-restore.service";
import { BackupIntrospectionService } from "./backup-introspection.service";
import { BackupProgressRegistry } from "./backup-progress.registry";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BackupController, SuperadminBackupController],
  providers: [
    BackupService,
    BackupExportService,
    BackupRestoreService,
    BackupIntrospectionService,
    BackupProgressRegistry,
  ],
  exports: [BackupService],
})
export class BackupModule {}
