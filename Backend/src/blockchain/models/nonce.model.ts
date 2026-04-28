export interface NonceReservation {
  reservationId: string;
  nonce: number;
  reservedAt: string;
  expiresAt: string;
}

export interface NonceState {
  network: string;
  address: string;
  chainNonce: number;
  nextNonce: number;
  usedNonces: number[];
  reservations: Record<string, NonceReservation>;
  updatedAt: string;
}

export interface ReserveNonceResult {
  network: string;
  address: string;
  nonce: number;
  reservationId: string;
  expiresAt: string;
  chainNonce: number;
  nextNonce: number;
}

export interface GapFillResult {
  network: string;
  address: string;
  chainNonce: number;
  nextNonce: number;
  gaps: number[];
  reserved?: ReserveNonceResult;
}
