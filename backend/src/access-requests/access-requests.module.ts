import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DecisionHelperModule } from '../decision-helper/decision-helper.module';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { RequestExpirationService } from './request-expiration.service';
import { RequestPdfService } from './request-pdf.service';
import { AccessRequest, AccessRequestSchema } from './schemas/access-request.schema';
import { RequestHistory, RequestHistorySchema } from './schemas/request-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccessRequest.name, schema: AccessRequestSchema },
      { name: RequestHistory.name, schema: RequestHistorySchema },
      { name: User.name, schema: UserSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    NotificationsModule,
    AuditLogsModule,
    DecisionHelperModule,
  ],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService, RequestExpirationService, RequestPdfService],
  exports: [AccessRequestsService],
})
export class AccessRequestsModule {}
