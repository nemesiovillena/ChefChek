import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  // Nombre del proveedor (texto libre, igual que el resto de Invoice); si se
  // omite y hay albaranId/purchaseOrderId, se resuelve del proveedor vinculado
  @IsOptional()
  @IsString()
  supplier?: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsDateString()
  issuedAt: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  albaranId?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class InvoicesQueryDto {
  @IsOptional()
  @IsString()
  albaranId?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;
}
