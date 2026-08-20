import { Global, Module } from '@nestjs/common';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';

@Global()
@Module({
  controllers: [ExtensionsController],
  providers: [ExtensionsService],
  exports: [ExtensionsService]
})
export class ExtensionsModule {}
