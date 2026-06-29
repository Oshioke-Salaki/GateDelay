import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ValidateCertificateDto,
  VerifyMarketDto,
} from './dto/verification.dto';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('markets/:marketId')
  verifyMarket(
    @Param('marketId') marketId: string,
    @Body() body: VerifyMarketDto,
  ) {
    return this.verificationService.verifyMarket(
      marketId,
      body.dataSource,
      body.payload,
      body.signature,
      body.signerAddress,
    );
  }

  @Get('markets/:marketId/history')
  getMarketHistory(@Param('marketId') marketId: string) {
    return this.verificationService.getMarketHistory(marketId);
  }

  @Post('certificates/validate')
  validateCertificate(@Body() body: ValidateCertificateDto) {
    return this.verificationService.validateCertificate(
      body.certificateId,
      body.payload,
      body.signature,
      body.signerAddress,
    );
  }
}
