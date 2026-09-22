import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SelectorInputSchema, type PowerCalculation } from '@voltstar/types';
import { SelectorService } from './selector.service';

@ApiTags('selector')
@Controller('selector')
export class SelectorController {
  constructor(private readonly selector: SelectorService) {}

  /** Розрахунок потрібної потужності генератора за формою підбору. */
  @Post('calculate')
  calculate(@Body() body: unknown): PowerCalculation {
    // Валідація вхідних даних через спільну zod-схему (@voltstar/types).
    const input = SelectorInputSchema.parse(body);
    return this.selector.calculatePower(input);
  }
}
