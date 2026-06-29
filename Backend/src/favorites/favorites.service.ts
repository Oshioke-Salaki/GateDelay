import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  FavoriteMarket,
  FavoritesSync,
  FavoriteAnalytics,
  MarketRecommendation,
} from './favorites.entity';
import {
  AddFavoriteDto,
  UpdateFavoriteDto,
  SyncFavoritesDto,
  RecommendationsQueryDto,
} from './dto/favorites.dto';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  // keyed by `${userId}:${marketId}` for O(1) existence checks
  private readonly favorites = new Map<string, FavoriteMarket>();
  // keyed by userId → syncToken
  private readonly syncTokens = new Map<string, FavoritesSync>();

  // ─── CRUD ────────────────────────────────────────────────────────────────

  addFavorite(userId: string, dto: AddFavoriteDto): FavoriteMarket {
    const compositeKey = this.key(userId, dto.marketId);

    if (this.favorites.has(compositeKey)) {
      throw new ConflictException(
        `Market '${dto.marketId}' is already in favorites`,
      );
    }

    const favorite: FavoriteMarket = {
      id: uuidv4(),
      userId,
      marketId: dto.marketId,
      addedAt: new Date(),
      viewCount: 0,
      tags: dto.tags ?? [],
      notes: dto.notes,
    };

    this.favorites.set(compositeKey, favorite);
    this.rotateSyncToken(userId);
    this.logger.log(`User ${userId} favorited market ${dto.marketId}`);
    return favorite;
  }

  getFavorites(userId: string): FavoriteMarket[] {
    return this.getUserFavorites(userId).sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime(),
    );
  }

  getFavorite(userId: string, marketId: string): FavoriteMarket {
    return this.getFavoriteOrThrow(userId, marketId);
  }

  updateFavorite(
    userId: string,
    marketId: string,
    dto: UpdateFavoriteDto,
  ): FavoriteMarket {
    const fav = this.getFavoriteOrThrow(userId, marketId);

    if (dto.tags !== undefined) fav.tags = dto.tags;
    if (dto.notes !== undefined) fav.notes = dto.notes;

    this.favorites.set(this.key(userId, marketId), fav);
    this.rotateSyncToken(userId);
    return fav;
  }

  removeFavorite(userId: string, marketId: string): void {
    this.getFavoriteOrThrow(userId, marketId);
    this.favorites.delete(this.key(userId, marketId));
    this.rotateSyncToken(userId);
    this.logger.log(`User ${userId} removed favorite market ${marketId}`);
  }

  removeAllFavorites(userId: string): void {
    const favs = this.getUserFavorites(userId);
    for (const fav of favs) {
      this.favorites.delete(this.key(userId, fav.marketId));
    }
    this.rotateSyncToken(userId);
    this.logger.log(`Cleared all favorites for user ${userId}`);
  }

  // ─── VIEW TRACKING ───────────────────────────────────────────────────────

  recordView(userId: string, marketId: string): FavoriteMarket {
    const fav = this.getFavoriteOrThrow(userId, marketId);
    fav.viewCount += 1;
    fav.lastViewedAt = new Date();
    this.favorites.set(this.key(userId, marketId), fav);
    return fav;
  }

  // ─── SYNC ─────────────────────────────────────────────────────────────────

  getSyncState(userId: string): FavoritesSync {
    return this.getOrCreateSync(userId);
  }

  sync(userId: string, dto: SyncFavoritesDto): FavoritesSync {
    const current = this.getOrCreateSync(userId);

    if (current.syncToken !== dto.syncToken) {
      throw new ConflictException({
        message: 'Sync token mismatch — client is out of date',
        serverSyncToken: current.syncToken,
        serverFavorites: current.favorites,
        serverUpdatedAt: current.updatedAt,
      });
    }

    const existingIds = new Set(
      this.getUserFavorites(userId).map((f) => f.marketId),
    );

    // Add markets the client has but server doesn't
    for (const marketId of dto.marketIds) {
      if (!existingIds.has(marketId)) {
        this.addFavorite(userId, { marketId });
      }
    }

    // Remove markets the server has but client no longer lists
    const clientIds = new Set(dto.marketIds);
    for (const marketId of existingIds) {
      if (!clientIds.has(marketId)) {
        this.favorites.delete(this.key(userId, marketId));
      }
    }

    return this.rotateSyncToken(userId);
  }

  // ─── RECOMMENDATIONS ─────────────────────────────────────────────────────

  getRecommendations(
    userId: string,
    query: RecommendationsQueryDto,
  ): MarketRecommendation[] {
    const limit = query.limit ?? 10;
    const userFavs = this.getUserFavorites(userId);

    if (userFavs.length === 0) {
      return this.getPopularMarkets(limit);
    }

    const tagFrequency = new Map<string, number>();
    for (const fav of userFavs) {
      for (const tag of fav.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
      }
    }

    const favoritedIds = new Set(userFavs.map((f) => f.marketId));
    const candidateScores = new Map<string, { score: number; reasons: string[] }>();

    // Score all non-favorited markets that other users have favorited
    for (const [compositeKey, fav] of this.favorites) {
      if (fav.userId === userId || favoritedIds.has(fav.marketId)) continue;

      const existing = candidateScores.get(fav.marketId) ?? { score: 0, reasons: [] };

      // Boost score for tag overlap
      for (const tag of fav.tags) {
        const freq = tagFrequency.get(tag) ?? 0;
        if (freq > 0) {
          existing.score += freq * 2;
          if (!existing.reasons.includes(`matches tag "${tag}"`)) {
            existing.reasons.push(`matches tag "${tag}"`);
          }
        }
      }

      // Boost score for high view count across users (popularity signal)
      existing.score += Math.log1p(fav.viewCount);
      if (fav.viewCount > 5 && !existing.reasons.includes('trending')) {
        existing.reasons.push('trending');
      }

      candidateScores.set(fav.marketId, existing);
    }

    const results: MarketRecommendation[] = [...candidateScores.entries()]
      .map(([marketId, { score, reasons }]) => ({
        marketId,
        score: Math.round(score * 100) / 100,
        reason: reasons.length > 0 ? reasons.join(', ') : 'popular market',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Pad with popular markets if we don't have enough candidates
    if (results.length < limit) {
      const existingIds = new Set(results.map((r) => r.marketId));
      const popular = this.getPopularMarkets(limit - results.length, [
        ...favoritedIds,
        ...existingIds,
      ]);
      results.push(...popular);
    }

    return results;
  }

  // ─── ANALYTICS ───────────────────────────────────────────────────────────

  getAnalytics(userId: string): FavoriteAnalytics {
    const userFavs = this.getUserFavorites(userId);

    const tagCounts = new Map<string, number>();
    for (const fav of userFavs) {
      for (const tag of fav.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const mostViewed = [...userFavs]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5)
      .map((f) => ({ marketId: f.marketId, viewCount: f.viewCount }));

    const recentlyViewed = [...userFavs]
      .filter((f) => f.lastViewedAt !== undefined)
      .sort((a, b) => b.lastViewedAt!.getTime() - a.lastViewedAt!.getTime())
      .slice(0, 5)
      .map((f) => ({ marketId: f.marketId, lastViewedAt: f.lastViewedAt! }));

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      userId,
      totalFavorites: userFavs.length,
      mostViewed,
      recentlyViewed,
      topTags,
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────

  private key(userId: string, marketId: string): string {
    return `${userId}:${marketId}`;
  }

  private getUserFavorites(userId: string): FavoriteMarket[] {
    return [...this.favorites.values()].filter((f) => f.userId === userId);
  }

  private getFavoriteOrThrow(userId: string, marketId: string): FavoriteMarket {
    const fav = this.favorites.get(this.key(userId, marketId));
    if (!fav) {
      throw new NotFoundException(
        `Market '${marketId}' not found in favorites`,
      );
    }
    return fav;
  }

  private getOrCreateSync(userId: string): FavoritesSync {
    if (!this.syncTokens.has(userId)) {
      this.rotateSyncToken(userId);
    }
    return this.syncTokens.get(userId)!;
  }

  private rotateSyncToken(userId: string): FavoritesSync {
    const state: FavoritesSync = {
      userId,
      syncToken: uuidv4(),
      favorites: this.getUserFavorites(userId),
      updatedAt: new Date(),
    };
    this.syncTokens.set(userId, state);
    return state;
  }

  private getPopularMarkets(
    limit: number,
    excludeIds: Iterable<string> = [],
  ): MarketRecommendation[] {
    const excluded = new Set(excludeIds);
    const popularity = new Map<string, number>();

    for (const fav of this.favorites.values()) {
      if (excluded.has(fav.marketId)) continue;
      popularity.set(
        fav.marketId,
        (popularity.get(fav.marketId) ?? 0) + 1 + Math.log1p(fav.viewCount),
      );
    }

    return [...popularity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([marketId, score]) => ({
        marketId,
        score: Math.round(score * 100) / 100,
        reason: 'popular market',
      }));
  }
}
