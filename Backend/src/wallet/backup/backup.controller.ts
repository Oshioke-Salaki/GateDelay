import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import {
  GenerateBackupDto,
  VerifyBackupDto,
  RestoreBackupDto,
} from './dto/backup.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WalletService } from '../wallet.service';

@Controller('wallets/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly walletService: WalletService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() dto: GenerateBackupDto) {
    return this.backupService.generateBackup(dto.password);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyBackupDto) {
    const isValid = await this.backupService.verifyBackup(
      dto.encryptedData,
      dto.password,
    );
    return { isValid };
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  async restore(
    @Request() req: { user: { userId: string } },
    @Body() dto: RestoreBackupDto,
  ) {
    const { address } = await this.backupService.restoreFromBackup(
      dto.encryptedData,
      dto.password,
    );
    return this.walletService.registerRecoveredWallet(req.user.userId, address);
  }

  @Post('download')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="wallet-backup.json"')
  async download(@Body() dto: GenerateBackupDto) {
    const backup = await this.backupService.generateBackup(dto.password);
    const buffer = Buffer.from(JSON.stringify(backup), 'utf-8');
    return new StreamableFile(buffer);
  }
}
