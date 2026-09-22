import { Injectable } from '@nestjs/common';
import type { LoadItem, PowerCalculation, SelectorInput } from '@voltstar/types';

/** Коефіцієнти пускового струму за типом навантаження. */
const STARTUP_COEFFICIENT: Record<LoadItem['loadType'], number> = {
  RESISTIVE: 1.0, // ТЕНи, лампи розжарювання — без стрибка
  ELECTRONIC: 1.5, // імпульсні БЖ, ПК
  INDUCTIVE: 3.0, // холодильники, насоси, кондиціонери
  MOTOR: 4.0, // двигуни з прямим пуском, компресори
};

/** Додатковий запас потужності залежно від режиму використання. */
const MODE_RESERVE: Record<SelectorInput['usageMode'], number> = {
  BACKUP: 0,
  PRIME: 0.1, // основне джерело — більший запас на тривалу роботу
  MOBILE: 0.05,
};

const POWER_FACTOR = 0.8; // cosφ для перерахунку кВт → кВА

@Injectable()
export class SelectorService {
  /**
   * Розрахунок потрібної потужності генератора під перелік споживачів.
   * Логіка: сумарна робоча потужність + пусковий стрибок + запас.
   */
  calculatePower(input: SelectorInput): PowerCalculation {
    let runningW = 0;
    let simultaneousExtraW = 0;
    let maxSequentialExtraW = 0;

    for (const item of input.items) {
      const itemRunningW = item.powerW * item.quantity;
      runningW += itemRunningW;

      const coeff = STARTUP_COEFFICIENT[item.loadType];
      const startupExtraW = itemRunningW * (coeff - 1);

      if (item.simultaneousStart) {
        // Усі одночасні стартери додаються разом.
        simultaneousExtraW += startupExtraW;
      } else {
        // Серед послідовних стартерів рахуємо лише найбільший стрибок.
        maxSequentialExtraW = Math.max(maxSequentialExtraW, startupExtraW);
      }
    }

    const peakW = Math.round(runningW + simultaneousExtraW + maxSequentialExtraW);

    const reserve = input.reserveFactor + MODE_RESERVE[input.usageMode];
    // Рекомендована номінальна потужність має покривати і робочу з запасом, і пік.
    const recommendedW = Math.round(Math.max(runningW * (1 + reserve), peakW));
    const recommendedKva = Number((recommendedW / 1000 / POWER_FACTOR).toFixed(2));

    return {
      runningW: Math.round(runningW),
      peakW,
      recommendedW,
      recommendedKva,
      phase: input.phase,
    };
  }

  /**
   * Ранжування кандидатів каталогу за відповідністю розрахунку.
   * Повний підбір із БД/Typesense реалізується у Phase 1.
   */
  rankCandidates<T extends { ratedPowerW: number; maxPowerW: number; phase: string }>(
    candidates: T[],
    calc: PowerCalculation,
  ): T[] {
    return candidates
      .filter((c) => c.ratedPowerW >= calc.recommendedW && c.maxPowerW >= calc.peakW)
      .filter((c) => c.phase === calc.phase)
      .sort((a, b) => a.ratedPowerW - b.ratedPowerW); // найближчий за потужністю — першим
  }
}
