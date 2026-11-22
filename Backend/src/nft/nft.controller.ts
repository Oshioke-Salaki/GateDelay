import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NftService } from './nft.service';
import { NftMintService } from './nft-mint.service';
import { IpfsUploadService } from './ipfs-upload.service';
import { RoyaltyConfigService } from './royalty-config.service';
import {
  RoyaltyNotFoundDto,
  RoyaltyQueryResponseDto,
  RoyaltyUnauthorizedDto,
} from './dto/royalty.dto';
import {
  MintBadRequestDto,
  MintConflictDto,
  MintNotFoundDto,
  PrepareMintTxDto,
  PrepareMintTxResponseDto,
} from './dto/mint.dto';
import {
  UploadClipMetadataDto,
  UploadClipMetadataResponseDto,
} from './dto/ipfs-upload.dto';
import {
  RoyaltyConfigResponseDto,
  SetRoyaltyBpsDto,
} from './dto/royalty-config.dto';

@ApiTags('nfts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nfts')
export class NftController {
  constructor(
    private readonly nftService: NftService,
    private readonly nftMintService: NftMintService,
    private readonly ipfsUploadService: IpfsUploadService,
    private readonly royaltyConfigService: RoyaltyConfigService,
  ) {}

  // ── Royalty BPS configuration ──────────────────────────────────────────

  @Get('clips/:clipId/royalty-config')
  @ApiOperation({
    summary: 'Get royaltyBps configured for a clip',
    description:
      'Returns the royalty basis points currently set on the clip. Default is 1000 (10%).',
  })
  @ApiParam({
    name: 'clipId',
    description: 'Clip identifier',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  @ApiOkResponse({
    description: 'Royalty BPS for the clip',
    type: RoyaltyConfigResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Clip not found', type: MintNotFoundDto })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT',
    type: RoyaltyUnauthorizedDto,
  })
  getRoyaltyConfig(@Param('clipId') clipId: string): RoyaltyConfigResponseDto {
    return this.royaltyConfigService.getRoyaltyBps(clipId);
  }

  @Patch('clips/:clipId/royalty-config')
  @ApiOperation({
    summary: 'Set royaltyBps for a clip',
    description:
      'Updates the royalty basis points on the clip. Minimum 0, maximum 1500, default 1000.',
  })
  @ApiParam({
    name: 'clipId',
    description: 'Clip identifier',
    example: 'clip_01HZX9K2M3N4P5Q6R7S8T9',
  })
  @ApiOkResponse({
    description: 'Royalty BPS updated',
    type: RoyaltyConfigResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid royaltyBps value',
    type: MintBadRequestDto,
  })
  @ApiNotFoundResponse({ description: 'Clip not found', type: MintNotFoundDto })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT',
    type: RoyaltyUnauthorizedDto,
  })
  setRoyaltyConfig(
    @Param('clipId') clipId: string,
    @Body() dto: SetRoyaltyBpsDto,
  ): RoyaltyConfigResponseDto {
    return this.royaltyConfigService.setRoyaltyBps({ ...dto, clipId });
  }

  @Post('metadata/upload')
  @ApiOperation({
    summary: 'Upload clip metadata to IPFS before minting',
    description:
      'Builds a standards-compliant NFT metadata object from the clip, uploads it to IPFS, and saves the resulting metadataUri back to the clip so it is ready for mint.',
  })
  @ApiOkResponse({
    description: 'Metadata uploaded; metadataUri and CID returned',
    type: UploadClipMetadataResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: MintBadRequestDto,
  })
  @ApiNotFoundResponse({
    description: 'Clip not found',
    type: MintNotFoundDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT bearer token',
    type: RoyaltyUnauthorizedDto,
  })
  uploadMetadata(
    @Body() dto: UploadClipMetadataDto,
  ): Promise<UploadClipMetadataResponseDto> {
    return this.ipfsUploadService.uploadMetadataToIPFS(dto);
  }

  @Post('mint/prepare')
  @ApiOperation({
    summary: 'Prepare unsigned Soroban NFT mint transaction',
    description:
      'Builds an unsigned Soroban mint transaction XDR for the given wallet and clip. Includes metadata URI and royalty BPS. The client signs and submits the XDR via their Stellar wallet.',
  })
  @ApiOkResponse({
    description: 'Unsigned mint transaction XDR ready for wallet signing',
    type: PrepareMintTxResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet address, missing metadata, or bad royalty BPS',
    type: MintBadRequestDto,
  })
  @ApiNotFoundResponse({
    description: 'Clip ID not found',
    type: MintNotFoundDto,
  })
  @ApiConflictResponse({
    description: 'Clip has already been minted',
    type: MintConflictDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT bearer token',
    type: RoyaltyUnauthorizedDto,
  })
  prepareMint(
    @Body() dto: PrepareMintTxDto,
  ): Promise<PrepareMintTxResponseDto> {
    return this.nftMintService.prepareMintTx(dto);
  }
  @Get(':mintAddress/royalty')
  @ApiOperation({
    summary: 'Query on-chain NFT royalty from Soroban',
    description:
      'Reads royalty BPS and recipient for a minted NFT via the Soroban get_royalties contract method. Results are cached for 5 minutes.',
  })
  @ApiParam({
    name: 'mintAddress',
    description: 'Soroban NFT mint / token contract address',
    example: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M',
  })
  @ApiOkResponse({
    description: 'Royalty data retrieved successfully',
    type: RoyaltyQueryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Royalty data not found for the given mint address',
    type: RoyaltyNotFoundDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT bearer token',
    type: RoyaltyUnauthorizedDto,
  })
  getRoyalty(
    @Param('mintAddress') mintAddress: string,
  ): Promise<RoyaltyQueryResponseDto> {
    return this.nftService.getOnChainRoyalty(mintAddress);
  }
}
