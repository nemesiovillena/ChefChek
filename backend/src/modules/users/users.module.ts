import { Module, forwardRef, Global } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { PrismaModule } from "../../common/services/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EmployeeAccountSyncService } from "../check-in/services/employee-account-sync.service";
import { TeamPositionsController } from "./team-positions.controller";
import { TeamPositionsService } from "./team-positions.service";

@Global()
@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [UsersController, TeamPositionsController],
  providers: [UsersService, EmployeeAccountSyncService, TeamPositionsService],
  exports: [UsersService, TeamPositionsService],
})
export class UsersModule {}
