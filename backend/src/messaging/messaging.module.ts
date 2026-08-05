import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccessRequest,
  AccessRequestSchema,
} from '../access-requests/schemas/access-request.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { RequestMessage, RequestMessageSchema } from './schemas/request-message.schema';
import { RequestThread, RequestThreadSchema } from './schemas/request-thread.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RequestThread.name, schema: RequestThreadSchema },
      { name: RequestMessage.name, schema: RequestMessageSchema },
      // Schémas seuls (aucun service importé) : contrôle d'accès et notifications
      { name: AccessRequest.name, schema: AccessRequestSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
    AuditLogsModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
