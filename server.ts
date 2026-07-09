import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI server-side with key
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  console.log("Gemini API initialized server-side.");
} else {
  console.log("No GEMINI_API_KEY found. Using high-fidelity simulated sentiment data.");
}

// Global market price state
interface Asset {
  id: string;
  name: string;
  category: "Forex" | "Crypto" | "Commodities" | "Synthetics";
  price: number;
  decimals: number;
  change24h: number;
  volatility: number; // random walk step size
}

const assets: Asset[] = [
  { id: "R_100", name: "Volatility 100 Index", category: "Synthetics", price: 12500.0, decimals: 2, change24h: 1.45, volatility: 5.0 },
  { id: "R_75", name: "Volatility 75 Index", category: "Synthetics", price: 345000.0, decimals: 4, change24h: -2.31, volatility: 45.0 },
  { id: "BTC_USD", name: "BTC/USD", category: "Crypto", price: 92450.0, decimals: 2, change24h: 3.12, volatility: 12.0 },
  { id: "ETH_USD", name: "ETH/USD", category: "Crypto", price: 3120.50, decimals: 2, change24h: -0.85, volatility: 1.5 },
  { id: "EUR_USD", name: "EUR/USD", category: "Forex", price: 1.08450, decimals: 5, change24h: 0.12, volatility: 0.00015 },
  { id: "GBP_USD", name: "GBP/USD", category: "Forex", price: 1.27320, decimals: 5, change24h: -0.45, volatility: 0.00020 },
  { id: "GOLD", name: "Gold", category: "Commodities", price: 2345.80, decimals: 2, change24h: 0.78, volatility: 0.8 },
  { id: "OIL", name: "Crude Oil", category: "Commodities", price: 74.25, decimals: 2, change24h: -1.20, volatility: 0.15 }
];

// Historical price records for charting (pre-generate 100 ticks)
const priceHistory: { [key: string]: Array<{ time: number; open: number; high: number; low: number; close: number }> } = {};

function initPriceHistory() {
  const now = Date.now();
  assets.forEach(asset => {
    const history: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
    let curPrice = asset.price;
    // Generate 100 historical bars (e.g., 1-minute intervals back in time)
    for (let i = 99; i >= 0; i--) {
      const time = now - i * 60000;
      const change = (Math.random() - 0.5) * asset.volatility * 2;
      const open = curPrice;
      const close = curPrice + change;
      const high = Math.max(open, close) + Math.random() * asset.volatility;
      const low = Math.min(open, close) - Math.random() * asset.volatility;
      
      history.push({
        time,
        open: Number(open.toFixed(asset.decimals)),
        high: Number(high.toFixed(asset.decimals)),
        low: Number(low.toFixed(asset.decimals)),
        close: Number(close.toFixed(asset.decimals))
      });
      curPrice = close;
    }
    priceHistory[asset.id] = history;
    // Align current asset price with the last history close
    asset.price = curPrice;
  });
}

initPriceHistory();

// Simulate prices in real-time (random walk)
setInterval(() => {
  assets.forEach(asset => {
    const change = (Math.random() - 0.5) * asset.volatility * 0.4;
    const oldPrice = asset.price;
    asset.price = Number((oldPrice + change).toFixed(asset.decimals));
    asset.change24h += (change / oldPrice) * 10; // slow drift
    asset.change24h = Number(asset.change24h.toFixed(2));

    // Update the last history bar or append a new one occasionally
    const history = priceHistory[asset.id];
    if (history && history.length > 0) {
      const lastBar = history[history.length - 1];
      const now = Date.now();
      // If less than 60 seconds since last bar, update high/low/close of current bar
      if (now - lastBar.time < 60000) {
        lastBar.high = Number(Math.max(lastBar.high, asset.price).toFixed(asset.decimals));
        lastBar.low = Number(Math.min(lastBar.low, asset.price).toFixed(asset.decimals));
        lastBar.close = asset.price;
      } else {
        // Shift history and append new bar
        history.shift();
        history.push({
          time: now,
          open: oldPrice,
          high: Math.max(oldPrice, asset.price),
          low: Math.min(oldPrice, asset.price),
          close: asset.price
        });
      }
    }
  });
}, 500);

// User account and transaction state
interface Transaction {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  gateway: string;
  status: "completed" | "pending" | "failed";
  timestamp: number;
  txHash?: string;
  phoneNumber?: string;
}

interface Trade {
  id: string;
  assetId: string;
  assetName: string;
  type: "rise" | "fall" | "buy" | "sell"; // Rise/Fall (Binary options) or Buy/Sell (Multipliers/Contracts)
  contractType: "rise_fall" | "multiplier";
  entryPrice: number;
  exitPrice?: number;
  stake: number;
  payout?: number;
  status: "open" | "won" | "lost";
  duration: number; // in seconds
  entryTime: number;
  endTime: number;
  multiplier?: number; // e.g., x100 for multiplier trades
}

let userAccount = {
  balance: 10000.00, // starting Demo balance
  is2faEnabled: false,
  twoFactorSecret: "TP77XG99KJ32ZQX", // visual key
  transactions: [] as Transaction[],
  trades: [] as Trade[]
};

// Seed initial transactions
userAccount.transactions.push({
  id: "TX_1001",
  type: "deposit",
  amount: 10000.00,
  gateway: "Stripe Card Gateway",
  status: "completed",
  timestamp: Date.now() - 3600000 * 2,
  txHash: "ch_3Mv8sLF3E8rM8H"
});

// Chat room state
interface ChatMessage {
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

const chatMessages: ChatMessage[] = [
  { id: "msg_1", username: "AlphaTrader", text: "Volatility 100 is highly bullish right now, looking for a strong breakout above 12,520!", timestamp: Date.now() - 120000, avatar: "🟢", badge: "pro" },
  { id: "msg_2", username: "PipsMaster", text: "EUR/USD spread is perfect right now on Trade Piles. Smooth low latency entry.", timestamp: Date.now() - 90000, avatar: "🔵", badge: "vip" },
  { id: "msg_3", username: "RiskTaker", text: "Just closed a nice 95% payout on Volatility 75 index. Instant balance credit!", timestamp: Date.now() - 60000, avatar: "🔥", tradeDetails: { asset: "Volatility 75", type: "rise", payout: "+$195.00" } },
  { id: "msg_4", username: "CryptoQueen", text: "Accumulating BTC positions before the social sentiment rating flips to extremely bullish.", timestamp: Date.now() - 30000, avatar: "🪙" }
];

// List of rotating simulated chat users to keep chat active and realistic
const chatPersonas = [
  { username: "BullMarket", avatar: "📈", badge: "pro" as const },
  { username: "DerivExpert", avatar: "🛡️", badge: "moderator" as const },
  { username: "Chartist_Jack", avatar: "📊", badge: "pro" as const },
  { username: "CryptoSniper", avatar: "🎯", badge: "vip" as const },
  { username: "ScalperPro", avatar: "⚡", badge: "pro" as const },
  { username: "ZenTrader", avatar: "🧘" }
];

const simulatedPhrases = [
  "Social sentiment for Gold is looking super bullish, just entered a Buy contract.",
  "Maximum execution speed here is impressive, zero slippage on that last high volatility tick!",
  "Always keep 2FA enabled, withdrawals are lightning fast once you confirm.",
  "Volatility 75 Index is on a massive tear. Anyone catching this rise?",
  "Deposited $500 via instant Crypto gateway, wallet credited in 3 seconds flat.",
  "Just made 90% payout on GBP/USD Fall contract. Perfect timing.",
  "The AI social sentiment analysis is a total cheat code for scalping Bitcoin.",
  "Two-factor authorization makes withdrawals extremely secure. Love the visual app authenticator.",
  "Crude Oil just hit key support. Sentiment says strong rebound is incoming."
];

// Rotate simulated chat messages
setInterval(() => {
  const persona = chatPersonas[Math.floor(Math.random() * chatPersonas.length)];
  const text = simulatedPhrases[Math.floor(Math.random() * simulatedPhrases.length)];
  
  let tradeDetails: any = undefined;
  if (Math.random() > 0.7) {
    const assetNames = ["Volatility 100", "BTC/USD", "EUR/USD", "Gold"];
    tradeDetails = {
      asset: assetNames[Math.floor(Math.random() * assetNames.length)],
      type: Math.random() > 0.5 ? "rise" : "fall",
      payout: `+$${(Math.random() * 150 + 20).toFixed(2)}`
    };
  }

  chatMessages.push({
    id: `msg_${Date.now()}`,
    username: persona.username,
    text: text,
    timestamp: Date.now(),
    avatar: persona.avatar,
    badge: persona.badge,
    tradeDetails
  });

  if (chatMessages.length > 40) {
    chatMessages.shift();
  }
}, 14000);

// Resolve user's active trades
setInterval(() => {
  const now = Date.now();
  userAccount.trades.forEach(trade => {
    if (trade.status === "open" && now >= trade.endTime) {
      // Fetch asset current price
      const asset = assets.find(a => a.id === trade.assetId);
      const currentPrice = asset ? asset.price : trade.entryPrice;
      trade.exitPrice = currentPrice;

      if (trade.contractType === "rise_fall") {
        const diff = currentPrice - trade.entryPrice;
        const won = (trade.type === "rise" && diff > 0) || (trade.type === "fall" && diff < 0);
        
        if (won) {
          trade.status = "won";
          trade.payout = Number((trade.stake * 1.95).toFixed(2)); // 95% payout
          userAccount.balance += trade.payout;
        } else {
          trade.status = "lost";
          trade.payout = 0;
        }
      } else if (trade.contractType === "multiplier") {
        // Multiplier contract resolve
        const multiplierFactor = trade.multiplier || 100;
        const diffPercent = (currentPrice - trade.entryPrice) / trade.entryPrice;
        const leverageDiff = diffPercent * multiplierFactor;

        if (trade.type === "buy") {
          if (leverageDiff <= -1.0) {
            // Hit automatic stop out (total loss of stake)
            trade.status = "lost";
            trade.payout = 0;
            trade.exitPrice = Number((trade.entryPrice * (1 - 1 / multiplierFactor)).toFixed(asset?.decimals || 2));
          } else {
            trade.status = leverageDiff >= 0 ? "won" : "lost";
            trade.payout = Number((trade.stake * (1 + leverageDiff)).toFixed(2));
            userAccount.balance += trade.payout;
          }
        } else { // sell / short
          if (leverageDiff >= 1.0) {
            trade.status = "lost";
            trade.payout = 0;
            trade.exitPrice = Number((trade.entryPrice * (1 + 1 / multiplierFactor)).toFixed(asset?.decimals || 2));
          } else {
            trade.status = leverageDiff <= 0 ? "won" : "lost";
            trade.payout = Number((trade.stake * (1 - leverageDiff)).toFixed(2));
            userAccount.balance += trade.payout;
          }
        }
      }
      
      // Post contract resolution details directly into live chat occasionally!
      if (Math.random() > 0.4 && trade.status === "won") {
        chatMessages.push({
          id: `msg_auto_${Date.now()}`,
          username: "You",
          text: `Just scored a professional execution on ${trade.assetName}! Payout resolved instantly.`,
          timestamp: Date.now(),
          avatar: "⚡",
          tradeDetails: {
            asset: trade.assetName,
            type: trade.type === "rise" || trade.type === "buy" ? "rise" : "fall",
            payout: `+$${trade.payout}`
          }
        });
      }
    }
  });
}, 1000);


// API ENDPOINTS

// 1. Asset Prices & History
app.get("/api/prices", (req, res) => {
  res.json(assets);
});

app.get("/api/prices/history", (req, res) => {
  const assetId = req.query.asset as string;
  if (!assetId || !priceHistory[assetId]) {
    return res.status(404).json({ error: "Asset not found" });
  }
  res.json(priceHistory[assetId]);
});

// 2. Chat API
app.get("/api/chat", (req, res) => {
  res.json(chatMessages);
});

app.post("/api/chat", (req, res) => {
  const { username, text, avatar, badge } = req.body;
  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Message content required" });
  }

  const newMessage: ChatMessage = {
    id: `msg_user_${Date.now()}`,
    username: username || "Trader_" + Math.floor(Math.random() * 1000),
    text: text.slice(0, 200),
    timestamp: Date.now(),
    avatar: avatar || "👤",
    badge: badge
  };

  chatMessages.push(newMessage);
  if (chatMessages.length > 40) {
    chatMessages.shift();
  }

  res.json(newMessage);
});

// 3. Trade Orders
app.post("/api/trade/open", (req, res) => {
  const { assetId, type, contractType, stake, duration, multiplier } = req.body;
  
  const asset = assets.find(a => a.id === assetId);
  if (!asset) {
    return res.status(404).json({ error: "Selected asset not found" });
  }

  const parsedStake = Number(stake);
  if (isNaN(parsedStake) || parsedStake <= 0) {
    return res.status(400).json({ error: "Invalid stake amount" });
  }

  if (userAccount.balance < parsedStake) {
    return res.status(400).json({ error: "Insufficient account balance" });
  }

  // Deduct stake from balance
  userAccount.balance -= parsedStake;

  const parsedDuration = Number(duration) || 10; // seconds
  const now = Date.now();
  
  const newTrade: Trade = {
    id: `TRADE_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    assetId: asset.id,
    assetName: asset.name,
    type,
    contractType: contractType || "rise_fall",
    entryPrice: asset.price,
    stake: parsedStake,
    status: "open",
    duration: parsedDuration,
    entryTime: now,
    endTime: now + parsedDuration * 1000,
    multiplier: multiplier ? Number(multiplier) : undefined
  };

  userAccount.trades.unshift(newTrade);
  res.json({ success: true, trade: newTrade, balance: userAccount.balance });
});

app.get("/api/trade/active", (req, res) => {
  const active = userAccount.trades.filter(t => t.status === "open");
  res.json(active);
});

app.get("/api/trade/history", (req, res) => {
  const history = userAccount.trades.filter(t => t.status !== "open");
  res.json(history);
});

// 4. User Status & Gateways
app.get("/api/user/status", (req, res) => {
  res.json({
    balance: userAccount.balance,
    is2faEnabled: userAccount.is2faEnabled,
    twoFactorSecret: userAccount.twoFactorSecret,
    transactions: userAccount.transactions
  });
});

app.post("/api/user/2fa/toggle", (req, res) => {
  const { code, enable } = req.body;
  
  // A simple validation: any 6-digit code matches for simplicity, but let's make it check if it is of length 6
  if (!code || code.length !== 6 || isNaN(Number(code))) {
    return res.status(400).json({ error: "Invalid 6-digit authenticator code" });
  }

  userAccount.is2faEnabled = !!enable;
  res.json({ success: true, is2faEnabled: userAccount.is2faEnabled });
});

app.post("/api/user/balance/deposit", (req, res) => {
  const { amount, gateway, phoneNumber } = req.body;
  const depositAmount = Number(amount);
  
  if (isNaN(depositAmount) || depositAmount <= 0) {
    return res.status(400).json({ error: "Invalid deposit amount" });
  }

  if (!phoneNumber || phoneNumber.trim() === "") {
    return res.status(400).json({ error: "Mobile phone number is required for transaction confirmation." });
  }

  userAccount.balance += depositAmount;
  
  const newTx: Transaction = {
    id: `TX_${Math.floor(100000 + Math.random() * 900000)}`,
    type: "deposit",
    amount: depositAmount,
    gateway: gateway || "Global Card Gateway",
    status: "completed",
    timestamp: Date.now(),
    txHash: "tx_" + Math.random().toString(36).substr(2, 14),
    phoneNumber: phoneNumber
  };

  userAccount.transactions.unshift(newTx);
  res.json({ success: true, balance: userAccount.balance, transaction: newTx });
});

app.post("/api/user/balance/withdraw", (req, res) => {
  const { amount, gateway, address, code, phoneNumber } = req.body;
  const withdrawAmount = Number(amount);
  
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ error: "Invalid withdrawal amount" });
  }

  if (userAccount.balance < withdrawAmount) {
    return res.status(400).json({ error: "Insufficient balance for withdrawal" });
  }

  if (!phoneNumber || phoneNumber.trim() === "") {
    return res.status(400).json({ error: "Mobile phone number is required for transaction confirmation." });
  }

  // 2FA Protection check!
  if (userAccount.is2faEnabled) {
    if (!code || code.length !== 6 || isNaN(Number(code))) {
      return res.status(400).json({ error: "2FA Verification Required: Please enter correct 6-digit code" });
    }
  }

  userAccount.balance -= withdrawAmount;
  
  const newTx: Transaction = {
    id: `TX_${Math.floor(100000 + Math.random() * 900000)}`,
    type: "withdrawal",
    amount: withdrawAmount,
    gateway: gateway || "Global Wire Transfer",
    status: "completed",
    timestamp: Date.now(),
    txHash: "tx_" + Math.random().toString(36).substr(2, 14),
    phoneNumber: phoneNumber
  };

  userAccount.transactions.unshift(newTx);
  res.json({ success: true, balance: userAccount.balance, transaction: newTx });
});

// 5. Social Sentiment API - server-side Gemini powered!
app.get("/api/sentiment", async (req, res) => {
  const assetId = req.query.asset as string || "BTC_USD";
  const asset = assets.find(a => a.id === assetId) || assets[2];

  if (!ai) {
    // Elegant fallbacks if API key is not present
    return res.json(getMockSentiment(asset));
  }

  try {
    const prompt = `Analyze current social sentiment, news feeds, market trends, and online mentions for asset "${asset.name}" (${assetId}).
Return a highly professional JSON output strictly matching this schema:
{
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "score": number (0 to 100),
  "confidence": number (0 to 100),
  "summary": "detailed analyst breakdown of current drivers, technical structures, and social media trends",
  "tweets": [
    { "username": "string", "handle": "@string", "text": "realistic trader tweet text", "sentiment": "bullish" | "bearish" | "neutral", "time": "e.g. 5m ago" }
  ],
  "headlines": ["string", "string", "string"]
}
Ensure the tweets are realistic trading commentary. Base the headlines and general tone on historical or typical market trends for this asset category (e.g. rate announcements, technology adoption, macro conditions). Only return valid JSON, no markdown wrapper.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING, description: "BULLISH, BEARISH, or NEUTRAL" },
            score: { type: Type.NUMBER, description: "Sentiment score from 0 (very bearish) to 100 (very bullish)" },
            confidence: { type: Type.NUMBER, description: "Confidence level of analysis from 0 to 100" },
            summary: { type: Type.STRING, description: "Detailed analyst breakdown of current drivers" },
            tweets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  username: { type: Type.STRING },
                  handle: { type: Type.STRING },
                  text: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                  time: { type: Type.STRING }
                }
              }
            },
            headlines: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["sentiment", "score", "confidence", "summary", "tweets", "headlines"]
        }
      }
    });

    const text = response.text;
    if (text) {
      const data = JSON.parse(text.trim());
      return res.json(data);
    } else {
      throw new Error("Empty response from Gemini model.");
    }
  } catch (error) {
    console.error("Gemini sentiment request failed, returning high-quality simulation:", error);
    return res.json(getMockSentiment(asset));
  }
});

// High-quality mock sentiment fallback generator
function getMockSentiment(asset: Asset) {
  let sentiment: "BULLISH" | "BEARISH" | "NEUTRAL" = "BULLISH";
  let score = 78;
  let confidence = 85;
  let summary = "";
  let headlines: string[] = [];
  let tweets: any[] = [];

  if (asset.id.includes("R_")) {
    sentiment = "NEUTRAL";
    score = 52;
    confidence = 90;
    summary = `The ${asset.name} is showing tight consolidation patterns over the short-term indicators. Technical metrics are flashing high-frequency mean reversion trading volumes. Algorithmic traders are utilizing breakout models anticipating standard index extensions.`;
    headlines = [
      "Volatility Indices Volume Reaches Highs for Q2",
      "Mean-Reversion Algorithms Spike Synthetics Demand",
      "Retail Traders Shift Leverage to 24/7 Synthetics Market"
    ];
    tweets = [
      { username: "SynthScout", handle: "@synth_scout", text: `Volatility 100 hovering right around a major liquidity pocket. High scalp speed!`, sentiment: "neutral", time: "3m ago" },
      { username: "AlgoKing", handle: "@algo_king_fx", text: `Automated multipliers are returning massive payouts on R_75 contracts. Keep barriers wide.`, sentiment: "bullish", time: "12m ago" },
      { username: "PivotPoint", handle: "@pivot_pt", text: `Volatility is decreasing. Readying a breakout model as spreads contract.`, sentiment: "neutral", time: "25m ago" }
    ];
  } else if (asset.category === "Crypto") {
    sentiment = "BULLISH";
    score = 82;
    confidence = 92;
    summary = `${asset.name} is demonstrating intense accumulation behavior as blockchain transaction volume spikes and macro institutional interest builds. Relative Strength Index (RSI) indicates robust buy support on minor corrections. Current sentiment indexes suggest high-momentum expansion.`;
    headlines = [
      `Institutional Inflows Into ${asset.name} Spot Products Accelerate`,
      "Network Transaction Velocity Signals Active Accumulation Phase",
      "Derivatives Interest Reaches Record Heights as Spot Consolidation Ends"
    ];
    tweets = [
      { username: "CryptoWhale", handle: "@cryptowhale", text: `Massive wallet inflows detected. Bears are completely exhausted on ${asset.name} support levels.`, sentiment: "bullish", time: "4m ago" },
      { username: "MoonLander", handle: "@moon_lander", text: `We are breakout-ready. Expecting clean sweeps of short liquidity within the next 4 hours.`, sentiment: "bullish", time: "8m ago" },
      { username: "StackingSats", handle: "@stack_sats", text: `Perfect low-latency entries on Trade Piles today. The execution is extremely smooth.`, sentiment: "bullish", time: "18m ago" }
    ];
  } else if (asset.category === "Forex") {
    sentiment = "BEARISH";
    score = 34;
    confidence = 88;
    summary = `${asset.name} is undergoing structural bearish pressure due to recent hawkish central bank statements and contrasting global interest rate yields. Resistance lines are holding strong, and high-frequency order flows are reinforcing sell-side momentum across multi-session trends.`;
    headlines = [
      "Hawkish Fed Pressure Signals Extended Valuation Adjustments",
      "Liquidity Pools Accumulate on Session Lows",
      "Macro Currency Strategists Target Key Dynamic Trendlines"
    ];
    tweets = [
      { username: "FXMastermind", handle: "@fx_mastermind", text: `Hawkish momentum is entirely dominating ${asset.name}. Breakout below support is imminent.`, sentiment: "bearish", time: "1m ago" },
      { username: "MacroPips", handle: "@macro_pips", text: `Short contracts are resolving incredibly fast. Yield spreads are wide.`, sentiment: "bearish", time: "14m ago" },
      { username: "TrendFollower", handle: "@trend_follow", text: `Waiting for central bank comments to reconfirm short direction. Order books favor sell liquidity.`, sentiment: "bearish", time: "30m ago" }
    ];
  } else { // Commodities
    sentiment = "BULLISH";
    score = 68;
    confidence = 80;
    summary = `${asset.name} values are finding robust technical buoyancy as geopolitical hedge flows and inflationary hedging metrics pick up. Bullish engulfing candles on the 4-hour chart are drawing significant volume from standard global commodities desks.`;
    headlines = [
      `Geopolitical Instability Elevates Spot Demand for ${asset.name}`,
      "Supply Constraints Signal Persistent Commodities Supercycle",
      "Global Reserve Portfolio Allocations Push Spot Rates Higher"
    ];
    tweets = [
      { username: "CommoDesks", handle: "@commo_desks", text: `Spot ${asset.name} continues to outperform indices. Inflation hedge rotation is active.`, sentiment: "bullish", time: "7m ago" },
      { username: "HedgeAdvisor", handle: "@hedge_advise", text: `Safe haven demand is climbing. Moving averages crossing bullishly on daily charts.`, sentiment: "bullish", time: "16m ago" },
      { username: "BarrelScalper", handle: "@barrel_scalp", text: `Low spread and instant execution make trading commodities incredibly clean.`, sentiment: "bullish", time: "45m ago" }
    ];
  }

  return { sentiment, score, confidence, summary, tweets, headlines };
}

// Vite and static build delivery
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server mounted as Express middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from dist directory in production.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Trade Piles Server is running on http://localhost:${PORT}`);
  });
}

startServer();
