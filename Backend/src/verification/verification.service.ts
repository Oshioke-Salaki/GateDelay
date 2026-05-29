import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Web3 } from 'web3';

export interface VerificationCertificate {
  id: string;
  marketId: string;
  dataSource: string;
  payloadHash: string;
  integrityVerified: boolean;
  authenticityVerified: boolean;
  signerAddress?: string;
  issuedAt: string;
}

export interface VerificationRecord {
  certificate: VerificationCertificate;
  payload: Record<string, unknown>;
}

@Injectable()
export class VerificationService {
  private readonly web3 = new Web3();
  private readonly recordsByMarket = new Map<string, VerificationRecord[]>();
  private readonly recordsByCertificate = new Map<string, VerificationRecord>();

  verifyMarket(
    marketId: string,
    dataSource: string,
    payload: Record<string, unknown>,
    signature?: string,
    signerAddress?: string,
  ): VerificationCertificate {
    if (signature && !signerAddress) {
      throw new BadRequestException(
        'signerAddress is required when signature is provided',
      );
    }

    const payloadHash = this.hashPayload(payload);
    const authenticityVerified = this.verifyAuthenticity(
      payloadHash,
      signature,
      signerAddress,
    );

    const certificate: VerificationCertificate = {
      id: randomUUID(),
      marketId,
      dataSource,
      payloadHash,
      integrityVerified: true,
      authenticityVerified,
      signerAddress,
      issuedAt: new Date().toISOString(),
    };

    const record: VerificationRecord = {
      certificate,
      payload: this.clone(payload),
    };

    if (!this.recordsByMarket.has(marketId)) {
      this.recordsByMarket.set(marketId, []);
    }
    this.recordsByMarket.get(marketId)?.push(record);
    this.recordsByCertificate.set(certificate.id, record);

    return certificate;
  }

  getMarketHistory(marketId: string): VerificationCertificate[] {
    return (this.recordsByMarket.get(marketId) ?? []).map(
      ({ certificate }) => certificate,
    );
  }

  validateCertificate(
    certificateId: string,
    payload: Record<string, unknown>,
    signature?: string,
    signerAddress?: string,
  ) {
    const record = this.recordsByCertificate.get(certificateId);
    if (!record) {
      throw new NotFoundException('Certificate not found');
    }

    const recalculatedHash = this.hashPayload(payload);
    const integrityVerified = recalculatedHash === record.certificate.payloadHash;

    const authenticityVerified = this.verifyAuthenticity(
      recalculatedHash,
      signature,
      signerAddress,
    );

    return {
      certificateId,
      marketId: record.certificate.marketId,
      integrityVerified,
      authenticityVerified,
      issuedAt: record.certificate.issuedAt,
      dataSource: record.certificate.dataSource,
    };
  }

  private verifyAuthenticity(
    payloadHash: string,
    signature?: string,
    signerAddress?: string,
  ): boolean {
    if (!signature || !signerAddress) {
      return false;
    }

    try {
      const recovered = this.web3.eth.accounts.recover(payloadHash, signature);
      return recovered.toLowerCase() === signerAddress.toLowerCase();
    } catch {
      return false;
    }
  }

  private hashPayload(payload: Record<string, unknown>): string {
    const serialised = this.stableStringify(payload);
    return createHash('sha256').update(serialised).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => a.localeCompare(b),
      );
      return `{${entries
        .map(
          ([key, entry]) =>
            `${JSON.stringify(key)}:${this.stableStringify(entry)}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private clone(payload: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  }
}
