import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WalletDocument = HydratedDocument<WalletOwnership>;

@Schema({ collection: 'wallet_ownerships', timestamps: false })
export class WalletOwnership {
  /** EIP-55 checksummed address — unique across the collection */
  @Prop({ required: true, unique: true, index: true })
  address: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  connectedAt: Date;

  @Prop({ required: true })
  network: string;
}

export const WalletOwnershipSchema = SchemaFactory.createForClass(WalletOwnership);
