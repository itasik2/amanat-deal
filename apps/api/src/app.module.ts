import { Module } from '@nestjs/common';
import { DealsModule } from './modules/deals/deals.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [HealthModule, DealsModule]
})
export class AppModule {}
