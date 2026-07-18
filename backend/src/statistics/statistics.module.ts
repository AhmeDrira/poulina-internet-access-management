import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AccessRequest,
  AccessRequestSchema,
} from '../access-requests/schemas/access-request.schema';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccessRequest.name, schema: AccessRequestSchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
