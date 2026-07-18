import { Module } from '@nestjs/common';
import { DecisionHelperService } from './decision-helper.service';

@Module({
  providers: [DecisionHelperService],
  exports: [DecisionHelperService],
})
export class DecisionHelperModule {}
