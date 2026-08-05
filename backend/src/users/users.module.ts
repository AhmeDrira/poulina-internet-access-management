import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccessRequest,
  AccessRequestSchema,
} from '../access-requests/schemas/access-request.schema';
import {
  RequestHistory,
  RequestHistorySchema,
} from '../access-requests/schemas/request-history.schema';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { RequestMessage, RequestMessageSchema } from '../messaging/schemas/request-message.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Service.name, schema: ServiceSchema },
      // Schémas seuls : vérification des références avant suppression d'un compte
      { name: AccessRequest.name, schema: AccessRequestSchema },
      { name: RequestHistory.name, schema: RequestHistorySchema },
      { name: RequestMessage.name, schema: RequestMessageSchema },
    ]),
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
