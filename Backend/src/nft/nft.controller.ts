import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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

@ApiTags('nfts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nfts')
export class NftController {
  constructor(
    private readonly nftService: NftService,
    private readonly nftMintService: NftMintService,
    private readonly ipfsUploadService: IpfsUploadService,
  ) {}

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
  constructor(private readonly nftService: NftService) {}

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
