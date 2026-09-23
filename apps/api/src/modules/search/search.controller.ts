import { Controller, HttpCode, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@voltstar/types';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Audited } from '../../common/audit/audit.interceptor';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Повна переіндексація каталогу (адмін). */
  @Post('reindex')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Audited('search.reindex', 'Search')
  async reindex() {
    if (!this.search.enabled) throw new ServiceUnavailableException('Typesense не налаштований');
    try {
      return await this.search.reindexAll();
    } catch (e) {
      throw new ServiceUnavailableException(`Індексація не вдалася: ${(e as Error).message}`);
    }
  }
}
