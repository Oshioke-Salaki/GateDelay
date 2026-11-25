import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { ExecutionVerifier } from './execution-verifier.service';
import { PositionSchema, AppliedExecutionSchema } from './position.schema';
import { AppCacheModule } from '../cache/cache.module';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([
    { name: 'Position', schema: PositionSchema },
    { name: 'AppliedExecution', schema: AppliedExecutionSchema },
  ]), AppCacheModule],
  controllers: [PositionsController],
  providers: [PositionsService, ExecutionVerifier],
  exports: [PositionsService],
})
export class PositionsModule {}
