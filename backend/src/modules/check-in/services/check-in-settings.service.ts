import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../common/services/prisma.service";
import {
  LABOR_AGREEMENT_PRESETS,
  findAgreementPreset,
} from "../constants/labor-agreement-presets";
import { UpdateCheckInSettingsDto } from "../dto/check-in-settings.dto";

/**
 * Ajustes de Check-In por tenant (fila única, creada con valores por defecto
 * la primera vez que se leen). Los parámetros de convenio se copian de una
 * plantilla y después se editan libremente.
 */
@Injectable()
export class CheckInSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    return this.prisma.checkInSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  listPresets() {
    return LABOR_AGREEMENT_PRESETS;
  }

  async update(tenantId: string, dto: UpdateCheckInSettingsDto) {
    await this.get(tenantId);
    return this.prisma.checkInSettings.update({
      where: { tenantId },
      data: {
        annualHours: dto.annualHours,
        weeklyHours: dto.weeklyHours,
        maxDailyHours: dto.maxDailyHours,
        minRestBetweenShiftsHours: dto.minRestBetweenShiftsHours,
        weeklyRestDays: dto.weeklyRestDays,
        nightStart: dto.nightStart,
        nightEnd: dto.nightEnd,
        vacationDays: dto.vacationDays,
        vacationDayType: dto.vacationDayType,
        overtimeYearlyCap: dto.overtimeYearlyCap,
        breaksCountAsWork: dto.breaksCountAsWork,
        autoCloseAfterHours: dto.autoCloseAfterHours,
        pinLength: dto.pinLength,
        allowBreaks: dto.allowBreaks,
        showRecentPunches: dto.showRecentPunches,
        showMonthPicker: dto.showMonthPicker,
        showOwnAdjustments: dto.showOwnAdjustments,
        showAddMissingDay: dto.showAddMissingDay,
      },
    });
  }

  /** Elige convenio: pisa los parámetros de convenio con los de la plantilla. */
  async applyPreset(tenantId: string, agreementKey: string) {
    const preset = findAgreementPreset(agreementKey);
    if (!preset) {
      throw new BadRequestException("Convenio no reconocido.");
    }
    await this.get(tenantId);
    return this.prisma.checkInSettings.update({
      where: { tenantId },
      data: { agreementKey: preset.key, ...preset.params },
    });
  }
}
