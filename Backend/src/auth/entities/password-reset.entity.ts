export interface PasswordReset {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumed: boolean;
  consumedAt?: Date;
}
