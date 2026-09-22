import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogQuerySchema, SegmentSchema, type Segment } from '@voltstar/types';
import { CatalogService } from './catalog.service';

/** Нормалізує query-параметр у масив рядків. */
function toArray(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function toNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  list(@Query() q: Record<string, unknown>) {
    const query = CatalogQuerySchema.parse({
      q: q.q ? String(q.q) : undefined,
      brand: toArray(q.brand),
      fuel: toArray(q.fuel),
      phase: q.phase ? String(q.phase) : undefined,
      minPowerW: toNumber(q.minPowerW),
      maxPowerW: toNumber(q.maxPowerW),
      inStock: q.inStock === 'true' ? true : undefined,
      page: toNumber(q.page) ?? 1,
      perPage: toNumber(q.perPage) ?? 24,
    });
    return this.catalog.list(query, this.segment(q.segment));
  }

  @Get('facets')
  facets() {
    return this.catalog.facets();
  }

  @Get('equipment-presets')
  presets() {
    return this.catalog.equipmentPresets();
  }

  @Get('products/:slug')
  getOne(@Param('slug') slug: string, @Query('segment') segment?: string) {
    return this.catalog.getBySlug(slug, this.segment(segment));
  }

  private segment(raw: unknown): Segment {
    const parsed = SegmentSchema.safeParse(raw);
    return parsed.success ? parsed.data : 'B2C';
  }
}
