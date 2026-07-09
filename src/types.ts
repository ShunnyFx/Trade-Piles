export interface Asset {
  id: string;
  name: string;
  category: "Forex" | "Crypto" | "Commodities" | "Synthetics";
  price: number;
  decimals: number;
  change24h: number;
  volatility: number;
}

export interface PriceBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  avatar: string;
  badge?: "pro" | "vip" | "moderator";
  tradeDetails?: {
    asset: string;
    type: "rise" | "fall";
    payout: string;
  };
}

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  gateway: string;
  status: "completed" | "pending" | "failed";
  timestamp: number;
  txHash?: string;
  phoneNumber?: string;
}

export interface Trade {
  id: string;
  assetId: string;
  assetName: string;
  type: "rise" | "fall" | "buy" | "sell";
  contractType: "rise_fall" | "multiplier";
  entryPrice: number;
  exitPrice?: number;
  stake: number;
  payout?: number;
  status: "open" | "won" | "lost";
  duration: number;
  entryTime: number;
  endTime: number;
  multiplier?: number;
}

export interface SentimentData {
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  score: number;
  confidence: number;
  summary: string;
  tweets: Array<{
    username: string;
    handle: string;
    text: string;
    sentiment: "bullish" | "bearish" | "neutral";
    time: string;
  }>;
  headlines: string[];
}
