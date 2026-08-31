import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { FoodLabelService } from "./services/food-label.service";
import { toPublicLabelView } from "./util/public-label-view.util";

/**
 * Ficha pública de trazabilidad de una etiqueta — SIN autenticación. El
 * `qrToken` (cuid opaco, no enumerable) es la única credencial; es lo que
 * codifica el QR impreso. Deliberadamente sin guards de auth/tenant/módulo.
 * Rate-limit propio más estricto que el global (el token no es adivinable pero
 * evita rastreo por fuerza bruta).
 */
@ApiTags("Etiquetado (público)")
@Controller("api/v1/etiquetado/public")
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class EtiquetadoPublicController {
  constructor(private readonly foodLabels: FoodLabelService) {}

  @Get("trace/:qrToken")
  async trace(@Param("qrToken") qrToken: string) {
    const label = await this.foodLabels.getByQrToken(qrToken);
    return toPublicLabelView(label);
  }
}
