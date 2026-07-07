import { Module, forwardRef } from "@nestjs/common";
import { TrashController } from "./trash.controller";
import { TrashService } from "./trash.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [TrashController],
  providers: [TrashService],
})
export class TrashModule {}
