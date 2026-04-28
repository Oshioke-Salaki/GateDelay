import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId: Types.ObjectId | null;

  @Prop({ default: 0 })
  popularity: number;

  @Prop({ type: [String], default: [] })
  marketIds: string[];
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Index for performance
CategorySchema.index({ parentId: 1 });
CategorySchema.index({ popularity: -1 });
