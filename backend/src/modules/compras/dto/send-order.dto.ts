import { IsIn } from "class-validator";
import type { SendChannel } from "../services/order-sending.service";

export class SendOrderDto {
  @IsIn(["EMAIL", "WHATSAPP", "PHONE", "WEB"])
  channel: SendChannel;
}
