export interface FavoriteMarket {
  id: string;
  userId: string;
  marketId: string;
  addedAt: Date;
  lastViewedAt?: Date;
  viewCount: number;
  tags: string[];
  notes?: string;
}

export interface FavoritesSync {
  userId: string;
  syncToken: string;
  favorites: FavoriteMarket[];
  updatedAt: Date;
}

export interface FavoriteAnalytics {
  userId: string;
  totalFavorites: number;
  mostViewed: Array<{ marketId: string; viewCount: number }>;
  recentlyViewed: Array<{ marketId: string; lastViewedAt: Date }>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface MarketRecommendation {
  marketId: string;
  score: number;
  reason: string;
}
