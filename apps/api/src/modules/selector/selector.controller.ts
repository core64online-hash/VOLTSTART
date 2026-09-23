import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SelectorInputSchema, type PowerCalculation } from '@voltstar/types';
import { PrismaService } from '../../prisma/prisma.service';
import { SelectorService } from './selector.service';

@ApiTags('selector')
@Controller('selector')
export class SelectorController {
  private readonly logger = new Logger(SelectorController.name);

  constructor(
    private readonly selector: SelectorService,
    private readonly prisma: PrismaService,
  ) {}

  /** Розрахунок потрібної потужності генератора за формою підбору. */
  @Post('calculate')
  calculate(@Body() body: unknown): PowerCalculation {
    // Валідація вхідних даних через спільну zod-схему (@voltstar/types).
    const input = SelectorInputSchema.parse(body);
    const result = this.selector.calculatePower(input);
    // Факт розрахунку — для звіту конверсії «підбір → заявка»; збій запису не впливає на відповідь.
    this.prisma.selectorRun
      .create({
        data: {
          recommendedW: Math.round(result.recommendedW),
          phase: input.phase,
          usageMode: input.usageMode,
          itemsCount: input.items.length,
        },
      })
      .catch((e: Error) => this.logger.warn(`Розрахунок підбору не записано: ${e.message}`));
    return result;
  }
}
