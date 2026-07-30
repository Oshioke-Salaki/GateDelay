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
import {
  RoyaltyNotFoundDto,
  RoyaltyQueryResponseDto,
  RoyaltyUnauthorizedDto,
} from './dto/royalty.dto';

@ApiTags('nfts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nfts')
export class NftController {
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
