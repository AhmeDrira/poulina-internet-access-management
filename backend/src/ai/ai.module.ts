import { Module } from '@nestjs/common';
import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FormDefinitionsModule } from '../form-definitions/form-definitions.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

/**
 * Assistance à la rédaction (API Claude).
 * Module optionnel : sans clé API, les endpoints répondent « désactivé »
 * et l'interface masque les boutons correspondants.
 */
@Module({
  imports: [AccessRequestsModule, FormDefinitionsModule, AuditLogsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
