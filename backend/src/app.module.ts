import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { ServicesModule } from './services/services.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { StatisticsModule } from './statistics/statistics.module';
import { DecisionHelperModule } from './decision-helper/decision-helper.module';
import { AiModule } from './ai/ai.module';
import { FormDefinitionsModule } from './form-definitions/form-definitions.module';
import { MessagingModule } from './messaging/messaging.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PasswordChangeGuard } from './common/guards/password-change.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://127.0.0.1:27017/poulina_internet_access'),
      }),
    }),
    ScheduleModule.forRoot(),
    // Limite globale généreuse ; une limite stricte est appliquée sur /auth/login
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule,
    UsersModule,
    DepartmentsModule,
    ServicesModule,
    AccessRequestsModule,
    NotificationsModule,
    AuditLogsModule,
    StatisticsModule,
    DecisionHelperModule,
    FormDefinitionsModule,
    MessagingModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Bloque l'application tant qu'un mot de passe imposé n'a pas été changé
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
  ],
})
export class AppModule {}
