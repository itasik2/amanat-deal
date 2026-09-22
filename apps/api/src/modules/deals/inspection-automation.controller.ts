import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { InspectionAutomationService } from './inspection-automation.service';

@Controller('internal/automation')
export class InspectionAutomationController {
  constructor(private readonly inspections: InspectionAutomationService) {}

  @Get('inspection-expirations')
  run(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET?.trim();

    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }

    return this.inspections.completeExpiredInspections();
  }
}
