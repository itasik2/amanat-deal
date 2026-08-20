import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';

@Controller('deals/:dealId/extensions')
export class ExtensionsController {
  constructor(private readonly extensions: ExtensionsService) {}

  @Get()
  list(@Param('dealId') dealId: string) {
    return this.extensions.list(dealId);
  }

  @Post(':type/enable')
  enable(
    @Param('dealId') dealId: string,
    @Param('type') type: string,
    @Body() body: { actorRole?: string }
  ) {
    return this.extensions.enable(dealId, type, body.actorRole);
  }
}
