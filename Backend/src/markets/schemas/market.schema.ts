import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { Document } from 'mongoose';
import type { MarketOutcome, MarketStatus } from '../market-resolver.service';

export type MarketDocument = MarketRecord & Document;

@Schema({
  collection: 'markets',
  timestamps: true,
  versionKey: false,
  id: false,
})
export class MarketRecord {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true, type: Date })
  deadline: Date;

  @Prop({ required: true, type: String, default: '0' })
  totalYesStake: string;

  @Prop({ required: true, type: String, default: '0' })
  totalNoStake: string;

  @Prop({
    required: true,
    enum: ['active', 'resolving', 'resolved', 'cancelled'],
  })
  status: MarketStatus;

  @Prop({ enum: ['YES', 'NO', 'VOID'] })
  outcome?: MarketOutcome;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  oracleData?: unknown;

  @Prop()
  categoryId?: string;

  @Prop()
  chainId?: number;

  @Prop()
  factoryAddress?: string;

  @Prop()
  factoryAbiVersion?: string;

  @Prop()
  marketAddress?: string;

  @Prop()
  creator?: string;

  @Prop()
  collateralToken?: string;

  @Prop({ type: String })
  minLiquidity?: string;

  @Prop()
  metadataURI?: string;

  @Prop()
  creationBlockNumber?: number;

  @Prop()
  creationTransactionHash?: string;

  @Prop()
  creationLogIndex?: number;
}

export const MarketSchema = SchemaFactory.createForClass(MarketRecord);

@Schema({
  collection: 'market_factory_checkpoints',
  timestamps: true,
  versionKey: false,
})
export class MarketFactoryCheckpoint {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  chainId: number;

  @Prop({ required: true })
  factoryAddress: string;

  @Prop({ required: true, default: -1 })
  lastProcessedBlock: number;
}

export type MarketFactoryCheckpointDocument = MarketFactoryCheckpoint & Document;
export const MarketFactoryCheckpointSchema =
  SchemaFactory.createForClass(MarketFactoryCheckpoint);
