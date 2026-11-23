import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResolutionService } from './resolution.service';
import { ResolutionController } from './resolution.controller';
import { ResolutionEvidenceService } from './resolution-evidence.service';
import { RESOLUTION_MODEL, ResolutionSchema } from './resolution.schema';
import { BlockchainModule } from '../blockchain/blockchain.module';
@Module({
  imports: [BlockchainModule, MongooseModule.forFeature([{ name: RESOLUTION_MODEL, schema: ResolutionSchema }])],
  controllers: [ResolutionController],
  providers: [ResolutionService, ResolutionEvidenceService],
  exports: [ResolutionService],
})
export class ResolutionModule {}
