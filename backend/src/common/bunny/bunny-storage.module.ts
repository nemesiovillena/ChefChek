import { Global, Module } from "@nestjs/common";
import { BunnyStorageService } from "./bunny-storage.service";

/**
 * Global: `BunnyStorageService` se inyecta en cualquier módulo (controllers de
 * subida de imagen, módulo de backups) sin necesidad de importar este módulo.
 */
@Global()
@Module({
  providers: [BunnyStorageService],
  exports: [BunnyStorageService],
})
export class BunnyStorageModule {}
