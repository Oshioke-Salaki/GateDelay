export interface User {
  id: string;
  email: string;
  password?: string;
  name?: string;
  provider?: 'local' | 'google' | 'twitter';
  providerId?: string;
  refreshToken?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
}
