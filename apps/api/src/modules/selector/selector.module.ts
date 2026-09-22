import { Module } from '@nestjs/common';
import { SelectorController } from './selector.controller';
import { SelectorService } from './selector.service';

@Module({
  controllers: [SelectorController],
  providers: [SelectorService],
  exports: [SelectorService],
})
export class SelectorModule {}
