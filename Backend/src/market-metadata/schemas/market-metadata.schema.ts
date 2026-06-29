import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketMetadataDocument = MarketMetadata & Document;

@Schema({ timestamps: true })
export class MarketMetadata {
  @Prop({ required: true, index: true })
  marketId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Object, default: {} })
  attributes: Record<string, unknown>;

  @Prop({ default: 1 })
  version: number;

  @Prop({ index: true })
  category?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const MarketMetadataSchema = SchemaFactory.createForClass(MarketMetadata);

// Compound index for versioned lookups
MarketMetadataSchema.index({ marketId: 1, version: -1 });
// Text index for search
MarketMetadataSchema.index({ name: 'text', description: 'text', tags: 'text' });
