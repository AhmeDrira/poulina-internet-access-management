import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccessRequest,
  AccessRequestSchema,
} from '../access-requests/schemas/access-request.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FormDefinitionsController } from './form-definitions.controller';
import { FormDefinitionsService } from './form-definitions.service';
import { FormDefinition, FormDefinitionSchema } from './schemas/form-definition.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FormDefinition.name, schema: FormDefinitionSchema },
      // Schéma seul (pas de service) : sert à compter l'usage des champs
      { name: AccessRequest.name, schema: AccessRequestSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [FormDefinitionsController],
  providers: [FormDefinitionsService],
  exports: [FormDefinitionsService],
})
export class FormDefinitionsModule {}
