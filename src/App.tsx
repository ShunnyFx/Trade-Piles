import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Shield,
  CreditCard,
  History,
  Activity,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Loader2,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Zap,
  Lock,
  Wallet,
  Globe,
  Sliders,
  DollarSign
} from "lucide-react";
import SecuritySettings from "./components/SecuritySettings";
import { Asset, PriceBar, ChatMessage, Transaction, Trade, SentimentData } from "./types";

export default function App() {
  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<"trade" | "cashier" | "history" | "security">("trade");
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Core Market Data
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceBar[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceTrend, setPriceTrend] = useState<{ [key: string]: "up" | "down" | "flat" }>({});

  // Technical Indicators Configuration
  const [chartMode, setChartMode] = useState<"area" | "candle">("area");
  const [showEMA, setShowEMA] = useState(true);
  const [showSMA, setShowSMA] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showSupportResistance, setShowSupportResistance] = useState(true);

  // Social Sentiment Data
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  // Chat Room Data
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [chatUsername, setChatUsername] = useState(() => {
    // Generate a pleasant random trader name
    const names = ["ApexTrader", "DeltaFlow", "PipsHunter", "GridRunner", "ZenMarket", "RiskManager"];
    return names[Math.floor(Math.random() * names.length)] + "_" + Math.floor(100 + Math.random() * 900);
  });
  const [userBadge] = useState<"pro" | "vip" | undefined>(Math.random() > 0.5 ? "pro" : undefined);

  // Execution Panel Input state
  const [contractType, setContractType] = useState<"rise_fall" | "multiplier">("rise_fall");
  const [stake, setStake] = useState<number>(100);
  const [duration, setDuration] = useState<number>(10); // in seconds
  const [multiplier, setMultiplier] = useState<number>(100); // multiplier level
  const [tradeExecutionSpeed, setTradeExecutionSpeed] = useState<number | null>(null);
  const [placingTrade, setPlacingTrade] = useState(false);
  const [tradeMessage, setTradeMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // User Account Details
  const [balance, setBalance] = useState<number>(10000.00);
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState("TP77XG99KJ32ZQX");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [resolvedTrades, setResolvedTrades] = useState<Trade[]>([]);

  // Cashier State
  const [cashierMode, setCashierMode] = useState<"deposit" | "withdraw">("deposit");
  const [cashierAmount, setCashierAmount] = useState<string>("500");
  const [selectedGateway, setSelectedGateway] = useState<string>("Stripe Mastercard Gateway");
  const [withdrawalAddress, setWithdrawalAddress] = useState<string>("");
  const [cashier2faCode, setCashier2faCode] = useState<string>("");
  const [cashierPhoneNumber, setCashierPhoneNumber] = useState<string>("");
  const [cashierError, setCashierError] = useState<string>("");
  const [cashierSuccess, setCashierSuccess] = useState<string>("");
  const [processingCashier, setProcessingCashier] = useState(false);

  // Performance/System details
  const [latency, setLatency] = useState<number>(12);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Chat auto-scroll reference
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Track previous prices to animate price flashes
  const prevPricesRef = useRef<{ [key: string]: number }>({});

  // 1. Live UTC Clock & Network Latency jitter
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace("T", " ").slice(0, 19) + " GMT");
      // Jitter latency slightly to feel extremely real and interactive
      setLatency(prev => {
        const delta = Math.floor((Math.random() - 0.5) * 4);
        const next = prev + delta;
        return next < 5 ? 5 : next > 25 ? 25 : next;
      });
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // 2. Poll prices and active trades frequently (500ms for ticker-level responsiveness)
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const res = await fetch("/api/prices");
        if (!res.ok) return;
        const data: Asset[] = await res.json();
        
        // Calculate flashing updates
        const nextTrends: { [key: string]: "up" | "down" | "flat" } = {};
        data.forEach(asset => {
          const prevPrice = prevPricesRef.current[asset.id];
          if (prevPrice !== undefined) {
            if (asset.price > prevPrice) nextTrends[asset.id] = "up";
            else if (asset.price < prevPrice) nextTrends[asset.id] = "down";
            else nextTrends[asset.id] = "flat";
          } else {
            nextTrends[asset.id] = "flat";
          }
          prevPricesRef.current[asset.id] = asset.price;
        });

        setAssets(data);
        setPriceTrend(nextTrends);

        // Update selected asset state to maintain fresh price feed
        if (selectedAsset) {
          const freshSelected = data.find(a => a.id === selectedAsset.id);
          if (freshSelected) {
            setSelectedAsset(freshSelected);
          }
        } else if (data.length > 0) {
          setSelectedAsset(data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch price ticker", err);
      }
    };

    const fetchAccountData = async () => {
      try {
        const [userRes, activeTradesRes, historyRes] = await Promise.all([
          fetch("/api/user/status"),
          fetch("/api/trade/active"),
          fetch("/api/trade/history")
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setBalance(userData.balance);
          setIs2faEnabled(userData.is2faEnabled);
          setTwoFactorSecret(userData.twoFactorSecret);
          setTransactions(userData.transactions);
        }

        if (activeTradesRes.ok) {
          const active = await activeTradesRes.json();
          setActiveTrades(active);
        }

        if (historyRes.ok) {
          const history = await historyRes.json();
          setResolvedTrades(history);
        }
      } catch (err) {
        console.error("Failed to sync account info", err);
      }
    };

    fetchMarketData();
    fetchAccountData();

    const intervalId = setInterval(() => {
      fetchMarketData();
      fetchAccountData();
    }, 750);

    return () => clearInterval(intervalId);
  }, [selectedAsset]);

  // 3. Fetch Selected Asset Historical Candle Data
  useEffect(() => {
    if (!selectedAsset) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/prices/history?asset=${selectedAsset.id}`);
        if (res.ok) {
          const history: PriceBar[] = await res.json();
          setPriceHistory(history);
        }
      } catch (err) {
        console.error("Failed to load historical candles", err);
      }
    };

    fetchHistory();
    // Refresh history periodically as well
    const historyInterval = setInterval(fetchHistory, 3000);
    return () => clearInterval(historyInterval);
  }, [selectedAsset]);

  // 4. Fetch Real-time Gemini Social Sentiment for Selected Asset
  const fetchSentiment = async (assetId: string) => {
    setLoadingSentiment(true);
    try {
      const res = await fetch(`/api/sentiment?asset=${assetId}`);
      if (res.ok) {
        const data: SentimentData = await res.json();
        setSentiment(data);
      }
    } catch (err) {
      console.error("Failed to load sentiment analysis", err);
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    if (!selectedAsset) return;
    fetchSentiment(selectedAsset.id);
  }, [selectedAsset?.id]);

  // 5. Chat Feed Polling
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch("/api/chat");
        if (res.ok) {
          const data: ChatMessage[] = await res.json();
          setChatMessages(data);
        }
      } catch (err) {
        console.error("Failed to pull chat", err);
      }
    };

    fetchChat();
    const chatInterval = setInterval(fetchChat, 2500);
    return () => clearInterval(chatInterval);
  }, []);

  // Scroll live chat to bottom when messages list updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);

  // 6. Handle Posting New Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim()) return;

    const body = {
      username: chatUsername,
      text: newChatMessage,
      avatar: userBadge === "vip" ? "💎" : userBadge === "pro" ? "⚡" : "👤",
      badge: userBadge
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const sent: ChatMessage = await res.json();
        setChatMessages(prev => [...prev, sent]);
        setNewChatMessage("");
      }
    } catch (err) {
      console.error("Failed to post chat message", err);
    }
  };

  // 7. Execute Trading Order with measured Execution Speed
  const handlePlaceTrade = async (type: "rise" | "fall" | "buy" | "sell") => {
    if (!selectedAsset) return;
    setPlacingTrade(true);
    setTradeMessage(null);

    const startTime = performance.now();

    const body = {
      assetId: selectedAsset.id,
      type,
      contractType,
      stake,
      duration,
      multiplier: contractType === "multiplier" ? multiplier : undefined
    };

    try {
      const res = await fetch("/api/trade/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const endTime = performance.now();
      const executionMs = Math.round(endTime - startTime);
      setTradeExecutionSpeed(executionMs);

      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setActiveTrades(prev => [data.trade, ...prev]);
        setTradeMessage({
          text: `Contract executed instantly in ${executionMs}ms at price ${selectedAsset.price.toFixed(selectedAsset.decimals)}!`,
          type: "success"
        });
      } else {
        setTradeMessage({ text: data.error || "Execution rejected by liquidity pool.", type: "error" });
      }
    } catch (err) {
      setTradeMessage({ text: "Network timeout. Execution speed too low.", type: "error" });
    } finally {
      setPlacingTrade(false);
      // Auto clear trade result message after 5 seconds
      setTimeout(() => setTradeMessage(null), 5000);
    }
  };

  // 8. Handle Security Settings toggles
  const handleToggle2FA = async (enable: boolean, code: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/user/2fa/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enable })
      });
      if (res.ok) {
        const data = await res.json();
        setIs2faEnabled(data.is2faEnabled);
        return true;
      }
    } catch (err) {
      console.error("Failed to change 2FA settings", err);
    }
    return false;
  };

  // 9. Deposit / Withdrawal Cashier Actions
  const handleCashierAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setCashierError("");
    setCashierSuccess("");
    setProcessingCashier(true);

    const amountNum = Number(cashierAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCashierError("Please specify a valid deposit or withdrawal amount.");
      setProcessingCashier(false);
      return;
    }

    if (!cashierPhoneNumber.trim()) {
      setCashierError("Mobile phone number is required for transaction confirmation.");
      setProcessingCashier(false);
      return;
    }

    const endpoint = cashierMode === "deposit" ? "/api/user/balance/deposit" : "/api/user/balance/withdraw";
    const payload = {
      amount: amountNum,
      gateway: selectedGateway,
      phoneNumber: cashierPhoneNumber,
      address: cashierMode === "withdraw" ? withdrawalAddress : undefined,
      code: cashierMode === "withdraw" ? cashier2faCode : undefined
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setTransactions(prev => [data.transaction, ...prev]);
        setCashierSuccess(
          cashierMode === "deposit"
            ? `Successfully credited $${amountNum.toFixed(2)} to balance via ${selectedGateway}! Confirmation details sent to ${cashierPhoneNumber}.`
            : `Withdrawal request for $${amountNum.toFixed(2)} processed securely! Confirmation details sent to ${cashierPhoneNumber}.`
        );
        setCashierAmount("");
        setWithdrawalAddress("");
        setCashier2faCode("");
        setCashierPhoneNumber("");
      } else {
        setCashierError(data.error || "Gateway validation failed.");
      }
    } catch (err) {
      setCashierError("A transaction timeout occurred. Gateway is retrying.");
    } finally {
      setProcessingCashier(false);
    }
  };

  // Technical Calculations helper to plot indicators on custom SVG
  const getIndicatorPlots = () => {
    if (priceHistory.length === 0) return { emas: [], smas: [], upperBands: [], lowerBands: [] };

    const closes = priceHistory.map(b => b.close);
    const emas: number[] = [];
    const smas: number[] = [];
    const upperBands: number[] = [];
    const lowerBands: number[] = [];

    // 1. Calculate EMA (period 12)
    const emaPeriod = 12;
    const k = 2 / (emaPeriod + 1);
    let prevEMA = closes[0];
    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        emas.push(prevEMA);
      } else {
        const curEMA = closes[i] * k + prevEMA * (1 - k);
        emas.push(curEMA);
        prevEMA = curEMA;
      }
    }

    // 2. Calculate SMA (period 20) and Bollinger Bands
    const smaPeriod = 20;
    for (let i = 0; i < closes.length; i++) {
      if (i < smaPeriod - 1) {
        smas.push(closes[i]);
        upperBands.push(closes[i]);
        lowerBands.push(closes[i]);
      } else {
        const slice = closes.slice(i - smaPeriod + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        const avg = sum / smaPeriod;
        smas.push(avg);

        // Standard Deviation
        const variance = slice.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / smaPeriod;
        const stdDev = Math.sqrt(variance);
        upperBands.push(avg + 2 * stdDev);
        lowerBands.push(avg - 2 * stdDev);
      }
    }

    return { emas, smas, upperBands, lowerBands };
  };

  const indicatorData = getIndicatorPlots();

  // SVG Chart Geometry Calculators
  const chartWidth = 900;
  const chartHeight = 360;
  const paddingY = 30;

  const minPrice = priceHistory.length > 0 ? Math.min(...priceHistory.map(b => b.low)) : 1;
  const maxPrice = priceHistory.length > 0 ? Math.max(...priceHistory.map(b => b.high)) : 100;
  const priceRange = maxPrice - minPrice || 1;

  const scaleY = (price: number) => {
    const val = chartHeight - paddingY - ((price - minPrice) / priceRange) * (chartHeight - paddingY * 2);
    return isNaN(val) ? chartHeight / 2 : val;
  };

  const scaleX = (index: number) => {
    return (index / Math.max(1, priceHistory.length - 1)) * (chartWidth - 40) + 20;
  };

  // SVG Path Generators for ticks/indicators
  const generateAreaPath = () => {
    if (priceHistory.length === 0) return "";
    let path = `M ${scaleX(0)} ${scaleY(priceHistory[0].close)}`;
    for (let i = 1; i < priceHistory.length; i++) {
      path += ` L ${scaleX(i)} ${scaleY(priceHistory[i].close)}`;
    }
    return path;
  };

  const generateFillPath = () => {
    if (priceHistory.length === 0) return "";
    const base = generateAreaPath();
    return `${base} L ${scaleX(priceHistory.length - 1)} ${chartHeight} L ${scaleX(0)} ${chartHeight} Z`;
  };

  const generateIndicatorPath = (values: number[]) => {
    if (values.length === 0) return "";
    let path = `M ${scaleX(0)} ${scaleY(values[0])}`;
    for (let i = 1; i < values.length; i++) {
      path += ` L ${scaleX(i)} ${scaleY(values[i])}`;
    }
    return path;
  };

  // Filter assets based on search query
  const filteredAssets = assets.filter(
    a =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#0B0E14] text-gray-200 min-h-screen flex flex-col font-sans select-none" id="app-root">
      
      {/* Top Header / Navigation Bar */}
      <nav className="h-14 border-b border-slate-800 bg-[#12161F] flex items-center justify-between px-6 shrink-0 relative z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab("trade")}>
            <div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-sky-900/40">TP</div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white leading-tight">Trade Piles</span>
              <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider">Premium Live Desk</span>
            </div>
          </div>
          <div className="flex gap-6 text-sm font-semibold text-slate-400 h-14">
            <button
              onClick={() => setActiveTab("trade")}
              className={`px-1 h-full border-b-2 transition-all flex items-center gap-2 ${activeTab === "trade" ? "border-sky-500 text-sky-400 font-bold" : "border-transparent hover:text-slate-200"}`}
            >
              <Activity className="w-4 h-4" />
              <span>Trading Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab("cashier")}
              className={`px-1 h-full border-b-2 transition-all flex items-center gap-2 ${activeTab === "cashier" ? "border-sky-500 text-sky-400 font-bold" : "border-transparent hover:text-slate-200"}`}
            >
              <Wallet className="w-4 h-4" />
              <span>Cashier Gateway</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-1 h-full border-b-2 transition-all flex items-center gap-2 ${activeTab === "history" ? "border-sky-500 text-sky-400 font-bold" : "border-transparent hover:text-slate-200"}`}
            >
              <History className="w-4 h-4" />
              <span>Transaction History</span>
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`px-1 h-full border-b-2 transition-all flex items-center gap-2 ${activeTab === "security" ? "border-sky-500 text-sky-400 font-bold" : "border-transparent hover:text-slate-200"}`}
            >
              <Shield className="w-4 h-4" />
              <span>Security Center</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none mb-1">DEMO BALANCE</div>
            <div className="text-base font-mono font-bold text-white flex items-center gap-1">
              <span>${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs text-slate-400 font-normal">USD</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800 mx-1"></div>
          
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 bg-[#1A1F29] px-3 py-1.5 rounded-full border transition-all ${
              is2faEnabled
                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${is2faEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></div>
            <span className="text-xs font-bold">{is2faEnabled ? "2FA SECURED" : "2FA UNPROTECTED"}</span>
          </button>

          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sky-300 text-sm shadow-inner" title="User Profile: JD">
            JD
          </div>
        </div>
      </nav>

      {/* Main Workspace Layout (Grid of content panels) */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Trade View */}
        {activeTab === "trade" && (
          <>
            {/* Left Sidebar: Asset Tickers */}
            <aside className="w-72 border-r border-slate-800 bg-[#0B0E14] flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search synthetic indices, crypto..."
                    className="w-full bg-[#1A1F29] border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-200 placeholder-slate-500"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto divide-y divide-slate-900 scrollbar-thin">
                <div className="text-[10px] uppercase font-bold text-slate-500 px-4 py-2 bg-[#12161F]/60 tracking-wider">
                  Available Markets
                </div>
                
                {filteredAssets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No assets match your search.</div>
                ) : (
                  filteredAssets.map((asset) => {
                    const isSelected = selectedAsset?.id === asset.id;
                    const changeVal = asset.change24h;
                    const trend = priceTrend[asset.id] || "flat";
                    
                    return (
                      <div
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className={`flex items-center justify-between p-3.5 cursor-pointer transition-all border-l-2 ${
                          isSelected
                            ? "bg-[#1A1F29] border-sky-500"
                            : "hover:bg-[#1A1F29]/40 border-transparent"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-200">{asset.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 bg-slate-900 rounded inline-block">
                            {asset.category}
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-xs font-mono font-bold transition-all duration-300 p-0.5 rounded ${
                              trend === "up"
                                ? "text-emerald-400 bg-emerald-500/10"
                                : trend === "down"
                                ? "text-rose-400 bg-rose-500/10"
                                : "text-slate-100"
                            }`}
                          >
                            {asset.price.toFixed(asset.decimals)}
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[10px] font-semibold">
                            {changeVal >= 0 ? (
                              <span className="text-emerald-400 font-bold flex items-center">
                                <ArrowUpRight className="w-3 h-3 inline" /> +{changeVal.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-rose-400 font-bold flex items-center">
                                <ArrowDownRight className="w-3 h-3 inline" /> {changeVal.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Toggle Info Footer */}
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="p-4 bg-[#12161F] border-t border-slate-800 flex items-center gap-3 w-full hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200">Global Chat Lounge</div>
                  <div className="text-[10px] text-slate-400">Join {chatMessages.length}+ online traders</div>
                </div>
                <span className="bg-sky-600/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {isChatOpen ? "COLLAPSE" : "OPEN"}
                </span>
              </button>
            </aside>

            {/* Trading Workspace Container */}
            <main className="flex-1 flex flex-col bg-[#0B0E14] overflow-y-auto">
              {selectedAsset ? (
                <>
                  {/* Current Active Asset Header */}
                  <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#12161F] shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm tracking-wide text-white uppercase">{selectedAsset.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-900 border border-slate-800 text-sky-400 rounded-full">
                          {selectedAsset.category}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-slate-800"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-slate-100">
                          {selectedAsset.price.toFixed(selectedAsset.decimals)}
                        </span>
                        {selectedAsset.change24h >= 0 ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                            +{selectedAsset.change24h.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">
                            {selectedAsset.change24h.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Chart Customizations */}
                      <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => setChartMode("area")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                            chartMode === "area" ? "bg-sky-500 text-slate-950 font-extrabold shadow" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          AREA CHART
                        </button>
                        <button
                          onClick={() => setChartMode("candle")}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                            chartMode === "candle" ? "bg-sky-500 text-slate-950 font-extrabold shadow" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          CANDLESTICKS
                        </button>
                      </div>

                      <div className="h-4 w-px bg-slate-800"></div>

                      {/* Technical Indicators Switchees */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setShowEMA(!showEMA)}
                          className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md border transition-all ${
                            showEMA
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-transparent text-slate-500 border-slate-800 hover:border-slate-700"
                          }`}
                          title="Exponential Moving Average (Period 12)"
                        >
                          EMA (12)
                        </button>
                        <button
                          onClick={() => setShowSMA(!showSMA)}
                          className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md border transition-all ${
                            showSMA
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-transparent text-slate-500 border-slate-800 hover:border-slate-700"
                          }`}
                          title="Simple Moving Average (Period 20)"
                        >
                          SMA (20)
                        </button>
                        <button
                          onClick={() => setShowBollinger(!showBollinger)}
                          className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md border transition-all ${
                            showBollinger
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              : "bg-transparent text-slate-500 border-slate-800 hover:border-slate-700"
                          }`}
                          title="Bollinger Bands (20, 2 StdDev)"
                        >
                          BOLL (20,2)
                        </button>
                        <button
                          onClick={() => setShowSupportResistance(!showSupportResistance)}
                          className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md border transition-all ${
                            showSupportResistance
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-transparent text-slate-500 border-slate-800 hover:border-slate-700"
                          }`}
                          title="Display Key Support & Resistance bounds"
                        >
                          S&R LEVELS
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SVG Custom High-Performance Latency Chart Canvas */}
                  <div className="flex-1 bg-black/60 relative overflow-hidden border-b border-slate-800 min-h-[300px]">
                    
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-10 pointer-events-none">
                      {Array.from({ length: 72 }).map((_, i) => (
                        <div key={i} className="border-b border-r border-white"></div>
                      ))}
                    </div>

                    {priceHistory.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-950/80">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                        <span className="text-xs font-bold font-mono tracking-wider">INITIALIZING LOW-LATENCY TICK CORRELATION ENGINE...</span>
                      </div>
                    ) : (
                      <>
                        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                          <defs>
                            {/* Area Glow Gradient */}
                            <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.00" />
                            </linearGradient>

                            {/* Bollinger Band Shading */}
                            <linearGradient id="bollingerShade" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.05" />
                              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.05" />
                            </linearGradient>
                          </defs>

                          {/* Grid Horizontal Value Indicators */}
                          <g stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3">
                            <line x1="0" y1={scaleY(minPrice + priceRange * 0.25)} x2={chartWidth} y2={scaleY(minPrice + priceRange * 0.25)} />
                            <line x1="0" y1={scaleY(minPrice + priceRange * 0.5)} x2={chartWidth} y2={scaleY(minPrice + priceRange * 0.5)} />
                            <line x1="0" y1={scaleY(minPrice + priceRange * 0.75)} x2={chartWidth} y2={scaleY(minPrice + priceRange * 0.75)} />
                          </g>

                          {/* 1. Draw Bollinger Bands Area if selected */}
                          {showBollinger && indicatorData.upperBands.length > 0 && (
                            <g>
                              {/* Draw area between bands */}
                              <path
                                d={`M ${scaleX(0)} ${scaleY(indicatorData.upperBands[0])} 
                                   ${indicatorData.upperBands.slice(1).map((val, idx) => `L ${scaleX(idx + 1)} ${scaleY(val)}`).join(" ")}
                                   L ${scaleX(indicatorData.lowerBands.length - 1)} ${scaleY(indicatorData.lowerBands[indicatorData.lowerBands.length - 1])}
                                   ${indicatorData.lowerBands.slice(0, -1).reverse().map((val, idx) => `L ${scaleX(indicatorData.lowerBands.length - 2 - idx)} ${scaleY(val)}`).join(" ")} Z`}
                                fill="url(#bollingerShade)"
                              />
                              <path
                                d={generateIndicatorPath(indicatorData.upperBands)}
                                fill="none"
                                stroke="#22d3ee"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                                opacity="0.6"
                              />
                              <path
                                d={generateIndicatorPath(indicatorData.lowerBands)}
                                fill="none"
                                stroke="#22d3ee"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                                opacity="0.6"
                              />
                            </g>
                          )}

                          {/* 2. Area Chart Drawing */}
                          {chartMode === "area" && (
                            <g>
                              {/* Glowing bottom gradient */}
                              <path d={generateFillPath()} fill="url(#areaGlow)" />
                              {/* Precision blue line */}
                              <path d={generateAreaPath()} fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
                            </g>
                          )}

                          {/* 3. Candlesticks Drawing */}
                          {chartMode === "candle" && (
                            <g>
                              {priceHistory.map((bar, i) => {
                                const x = scaleX(i);
                                const candleWidth = Math.max(2, (chartWidth / priceHistory.length) * 0.6);
                                const openY = scaleY(bar.open);
                                const closeY = scaleY(bar.close);
                                const highY = scaleY(bar.high);
                                const lowY = scaleY(bar.low);
                                const isBullish = bar.close >= bar.open;

                                return (
                                  <g key={i} className="hover:opacity-80 cursor-pointer">
                                    {/* Wick line */}
                                    <line x1={x} y1={highY} x2={x} y2={lowY} stroke={isBullish ? "#10b981" : "#f43f5e"} strokeWidth="1.2" />
                                    {/* Candle body */}
                                    <rect
                                      x={x - candleWidth / 2}
                                      y={Math.min(openY, closeY)}
                                      width={candleWidth}
                                      height={Math.max(1, Math.abs(openY - closeY))}
                                      fill={isBullish ? "#10b981" : "#f43f5e"}
                                      rx="1"
                                    />
                                  </g>
                                );
                              })}
                            </g>
                          )}

                          {/* 4. Overlay Moving Average indicators */}
                          {showEMA && indicatorData.emas.length > 0 && (
                            <path
                              d={generateIndicatorPath(indicatorData.emas)}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="1.5"
                              opacity="0.8"
                            />
                          )}

                          {showSMA && indicatorData.smas.length > 0 && (
                            <path
                              d={generateIndicatorPath(indicatorData.smas)}
                              fill="none"
                              stroke="#a855f7"
                              strokeWidth="1.5"
                              opacity="0.8"
                            />
                          )}

                          {/* 5. Support and Resistance Boundaries */}
                          {showSupportResistance && (
                            <g opacity="0.4">
                              {/* Resistance line */}
                              <line
                                x1="0"
                                y1={scaleY(maxPrice - priceRange * 0.05)}
                                x2={chartWidth}
                                y2={scaleY(maxPrice - priceRange * 0.05)}
                                stroke="#f43f5e"
                                strokeWidth="1.5"
                                strokeDasharray="3,3"
                              />
                              <text
                                x={chartWidth - 100}
                                y={scaleY(maxPrice - priceRange * 0.05) - 6}
                                fill="#f43f5e"
                                fontSize="9"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                RESISTANCE LIMIT
                              </text>

                              {/* Support line */}
                              <line
                                x1="0"
                                y1={scaleY(minPrice + priceRange * 0.05)}
                                x2={chartWidth}
                                y2={scaleY(minPrice + priceRange * 0.05)}
                                stroke="#10b981"
                                strokeWidth="1.5"
                                strokeDasharray="3,3"
                              />
                              <text
                                x={chartWidth - 100}
                                y={scaleY(minPrice + priceRange * 0.05) + 12}
                                fill="#10b981"
                                fontSize="9"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                SUPPORT BARRIER
                              </text>
                            </g>
                          )}

                          {/* 6. Glowing Current Live Spot Indicator */}
                          {priceHistory.length > 0 && (
                            <g>
                              <circle
                                cx={scaleX(priceHistory.length - 1)}
                                cy={scaleY(selectedAsset.price)}
                                r="8"
                                fill="#0ea5e9"
                                className="animate-ping"
                                opacity="0.4"
                              />
                              <circle
                                cx={scaleX(priceHistory.length - 1)}
                                cy={scaleY(selectedAsset.price)}
                                r="4"
                                fill="#0ea5e9"
                              />
                              {/* Horizontal current tick price display bar */}
                              <line
                                x1="0"
                                y1={scaleY(selectedAsset.price)}
                                x2={scaleX(priceHistory.length - 1)}
                                y2={scaleY(selectedAsset.price)}
                                stroke="#0ea5e9"
                                strokeWidth="0.8"
                                strokeDasharray="2,2"
                                opacity="0.7"
                              />
                            </g>
                          )}
                        </svg>

                        {/* Hover Overlay Labels */}
                        <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1.5 text-[10px] font-mono space-y-0.5 pointer-events-none">
                          <div className="text-slate-400">SPOT CORRELATION DATA</div>
                          <div className="text-white flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                            <span>SPOT: {selectedAsset.price.toFixed(selectedAsset.decimals)}</span>
                          </div>
                          {showEMA && (
                            <div className="text-amber-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>EMA (12): {indicatorData.emas[indicatorData.emas.length - 1]?.toFixed(selectedAsset.decimals)}</span>
                            </div>
                          )}
                          {showSMA && (
                            <div className="text-purple-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              <span>SMA (20): {indicatorData.smas[indicatorData.smas.length - 1]?.toFixed(selectedAsset.decimals)}</span>
                            </div>
                          )}
                          {showBollinger && (
                            <div className="text-cyan-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                              <span>BOLL: {indicatorData.upperBands[indicatorData.upperBands.length - 1]?.toFixed(selectedAsset.decimals)} / {indicatorData.lowerBands[indicatorData.lowerBands.length - 1]?.toFixed(selectedAsset.decimals)}</span>
                            </div>
                          )}
                        </div>

                        {/* Floating Interactive Active Trade markers inside the Chart area */}
                        {activeTrades
                          .filter(t => t.assetId === selectedAsset.id)
                          .map((trade, idx) => {
                            const yPos = scaleY(trade.entryPrice);
                            return (
                              <div
                                key={trade.id}
                                className="absolute left-6 select-none flex items-center gap-2 pointer-events-none"
                                style={{ top: `${yPos - 12}px` }}
                              >
                                <div className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider text-slate-950 shadow-md ${
                                  trade.type === "rise" || trade.type === "buy" ? "bg-emerald-400 animate-pulse" : "bg-rose-400 animate-pulse"
                                }`}>
                                  YOUR ORDER ({trade.type.toUpperCase()}) @ {trade.entryPrice.toFixed(selectedAsset.decimals)}
                                </div>
                                <div className="h-0.5 w-40 border-t border-dashed border-sky-400"></div>
                              </div>
                            );
                          })}
                      </>
                    )}
                  </div>

                  {/* Social Sentiment Analysis & Media Trends (Gemini Driven) */}
                  <div className="bg-[#12161F] border-t border-slate-800 p-5 flex flex-col md:flex-row gap-6 shrink-0 relative">
                    
                    {/* Sentiment meter */}
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Social Sentiment Analysis</span>
                          <span className="px-2 py-0.5 bg-sky-500/10 text-[9px] text-sky-400 border border-sky-500/20 rounded font-bold uppercase tracking-widest">
                            Gemini Powered AI
                          </span>
                        </div>
                        <button
                          onClick={() => fetchSentiment(selectedAsset.id)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-800 transition-colors"
                          title="Recalculate Sentiment with Gemini AI"
                          disabled={loadingSentiment}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingSentiment ? "animate-spin text-sky-400" : ""}`} />
                        </button>
                      </div>

                      {sentiment ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            {/* Dial/Bar indicators */}
                            <div className="relative w-16 h-16 rounded-full border-2 border-slate-800 flex flex-col items-center justify-center shrink-0">
                              <span className="text-xs font-mono font-bold text-white">{sentiment.score}%</span>
                              <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">Score</span>
                            </div>
                            <div className="space-y-1 flex-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className={sentiment.sentiment === "BULLISH" ? "text-emerald-400" : sentiment.sentiment === "BEARISH" ? "text-rose-400" : "text-amber-400"}>
                                  {sentiment.sentiment} MOMENTUM
                                </span>
                                <span className="text-slate-400">Confidence: {sentiment.confidence}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-950 rounded-full flex overflow-hidden border border-slate-800/80">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${sentiment.score}%` }}></div>
                                <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${100 - sentiment.score}%` }}></div>
                              </div>
                              <div className="flex justify-between mt-1 text-[9px] text-slate-500 font-semibold font-mono">
                                <span>{sentiment.score}% Bullish Buy Mentions</span>
                                <span>{(100 - sentiment.score)}% Bearish Short Mentions</span>
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-900 font-medium">
                            {sentiment.summary}
                          </p>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-xs text-slate-500">Loading social metrics...</div>
                      )}
                    </div>

                    {/* Social Tweet Feed / Market News ticker */}
                    <div className="w-full md:w-[320px] bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between max-h-[160px] overflow-y-auto">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>LIVE CHATTER & MEDIA HEADLINES</span>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      </div>
                      
                      {sentiment && sentiment.tweets && sentiment.tweets.length > 0 ? (
                        <div className="space-y-2.5 scrollbar-thin overflow-y-auto pr-1">
                          {sentiment.tweets.map((tw, i) => (
                            <div key={i} className="text-[11px] leading-relaxed border-b border-slate-900 pb-2 last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="font-bold text-slate-200">{tw.username} <span className="text-[9px] text-slate-500 font-normal">{tw.handle}</span></span>
                                <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${
                                  tw.sentiment === "bullish" ? "bg-emerald-500/10 text-emerald-400" : tw.sentiment === "bearish" ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-400"
                                }`}>
                                  {tw.sentiment}
                                </span>
                              </div>
                              <p className="text-slate-400 font-medium italic">"{tw.text}"</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-slate-500 my-auto">Analyzing stream...</div>
                      )}
                    </div>

                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950/20">
                  <Loader2 className="w-10 h-10 animate-spin text-sky-500 mb-4" />
                  <span className="text-sm font-bold uppercase text-slate-400">Loading Market Instruments...</span>
                </div>
              )}
            </main>

            {/* Right Execution Sidebar Panel */}
            <aside className="w-80 border-l border-slate-800 bg-[#12161F] p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contract Type</label>
                    <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-widest">
                      Zero Slippage
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setContractType("rise_fall")}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                        contractType === "rise_fall"
                          ? "bg-slate-800 text-sky-400 shadow font-extrabold border border-slate-700"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Rise / Fall (95%)
                    </button>
                    <button
                      onClick={() => setContractType("multiplier")}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                        contractType === "multiplier"
                          ? "bg-slate-800 text-sky-400 shadow font-extrabold border border-slate-700"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Multiplier
                    </button>
                  </div>
                </div>

                {/* Duration Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contract Duration</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 10, 30, 60].map((t) => (
                      <button
                        key={t}
                        onClick={() => setDuration(t)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                          duration === t
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/30 font-extrabold"
                            : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900"
                        }`}
                      >
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stake Value input */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stake Amount (USD)</label>
                    <span className="text-[10px] font-mono font-semibold text-slate-400">Limit: $10k</span>
                  </div>
                  <div className="flex items-center bg-slate-950 rounded-lg border border-slate-850 p-1">
                    <button
                      onClick={() => setStake(prev => Math.max(10, prev - 50))}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-300 font-bold rounded border border-slate-800"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center font-mono text-base font-extrabold text-white">
                      ${stake.toFixed(2)}
                    </div>
                    <button
                      onClick={() => setStake(prev => Math.min(10000, prev + 50))}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-300 font-bold rounded border border-slate-800"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Multiplier Multiplier picker if selected */}
                {contractType === "multiplier" && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Multiplier Value</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[50, 100, 200].map((m) => (
                        <button
                          key={m}
                          onClick={() => setMultiplier(m)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                            multiplier === m
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900"
                          }`}
                        >
                          x{m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Estimated Payout Calculator Panel */}
                {selectedAsset && (
                  <div className="bg-[#0B0E14] rounded-xl p-4 border border-slate-800 space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-sky-500/5 rounded-bl-full pointer-events-none"></div>
                    <div className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-bold">Estimated Contract Outcome</div>
                    <div className="text-2xl font-mono font-extrabold text-center text-white">
                      ${contractType === "rise_fall"
                        ? (stake * 1.95).toFixed(2)
                        : (stake * (1 + (multiplier / 100) * 0.1)).toFixed(2) // simulated estimation
                      }
                    </div>
                    <div className="text-[10px] text-emerald-400 font-extrabold text-center uppercase tracking-widest flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />
                      <span>+{contractType === "rise_fall" ? "95%" : `${multiplier}%`} Max Return Payout</span>
                    </div>
                  </div>
                )}

                {/* Main Action Buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    disabled={placingTrade}
                    onClick={() => handlePlaceTrade(contractType === "rise_fall" ? "rise" : "buy")}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-extrabold py-3.5 rounded-xl shadow-lg shadow-emerald-950/20 transition-all text-base tracking-wider uppercase flex items-center justify-center gap-2"
                  >
                    {placingTrade ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                    <span>{contractType === "rise_fall" ? "BUY / RISE" : "BUY CONTRACT"}</span>
                  </button>

                  <button
                    disabled={placingTrade}
                    onClick={() => handlePlaceTrade(contractType === "rise_fall" ? "fall" : "sell")}
                    className="w-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-rose-950/20 transition-all text-base tracking-wider uppercase flex items-center justify-center gap-2"
                  >
                    {placingTrade ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingDown className="w-5 h-5" />}
                    <span>{contractType === "rise_fall" ? "SELL / FALL" : "SELL CONTRACT"}</span>
                  </button>
                </div>

                {/* Instant status notice */}
                {tradeMessage && (
                  <div className={`p-3 rounded-lg border text-xs font-semibold leading-relaxed flex gap-2 items-start ${
                    tradeMessage.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 animate-fadeIn"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-fadeIn"
                  }`}>
                    {tradeMessage.type === "success" ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>{tradeMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Secure Trust Badges info */}
              <div className="border-t border-slate-800/80 pt-4 mt-4">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-850">
                  <div className="text-[10px] font-bold text-sky-400 mb-2 tracking-wider uppercase flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Global Cashier gateways</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-pointer">
                    <div className="h-5 bg-slate-900 border border-slate-800 rounded flex items-center justify-center text-[8px] font-extrabold text-slate-300 font-mono">VISA</div>
                    <div className="h-5 bg-slate-900 border border-slate-800 rounded flex items-center justify-center text-[8px] font-extrabold text-slate-300 font-mono">STRIPE</div>
                    <div className="h-5 bg-slate-900 border border-slate-800 rounded flex items-center justify-center text-[8px] font-extrabold text-slate-300 font-mono">BTC</div>
                    <div className="h-5 bg-slate-900 border border-slate-800 rounded flex items-center justify-center text-[8px] font-extrabold text-slate-300 font-mono">USDT</div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Floating Collapsible Live Chat Lounge Drawer */}
            {isChatOpen && (
              <aside className="w-80 border-l border-slate-800 bg-[#0B0E14] flex flex-col shrink-0 relative z-10 animate-slideLeft">
                <div className="p-4 border-b border-slate-800 bg-[#12161F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-extrabold text-white tracking-wide uppercase">Trader chat lounge</span>
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                  {chatMessages.map((msg) => {
                    const isSelf = msg.username === chatUsername || msg.username === "You";
                    return (
                      <div key={msg.id} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{msg.avatar}</span>
                          <span className={`text-[11px] font-extrabold ${isSelf ? "text-sky-400" : "text-slate-300"}`}>
                            {msg.username}
                          </span>
                          {msg.badge && (
                            <span className={`px-1 py-0.2 text-[7px] font-extrabold uppercase rounded ${
                              msg.badge === "moderator"
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                : msg.badge === "vip"
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/20"
                                : "bg-sky-500/20 text-sky-400 border border-sky-500/20"
                            }`}>
                              {msg.badge}
                            </span>
                          )}
                          <span className="text-[8px] text-slate-500 font-mono ml-auto">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </div>
                        
                        <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                          isSelf
                            ? "bg-sky-500/5 border-sky-500/10 text-slate-200"
                            : "bg-slate-900 border-slate-800 text-slate-300"
                        }`}>
                          <p className="font-medium">{msg.text}</p>
                          
                          {msg.tradeDetails && (
                            <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 font-bold uppercase tracking-wider">RESOLVED: {msg.tradeDetails.asset}</span>
                              <span className="text-emerald-400 font-extrabold font-mono">{msg.tradeDetails.payout}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat message composer */}
                <form onSubmit={handleSendChat} className="p-4 border-t border-slate-800 bg-[#12161F] flex gap-2">
                  <input
                    type="text"
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    placeholder="Discuss trades, strategies..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500 text-slate-100 placeholder-slate-600"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-sky-500 hover:bg-sky-600 active:scale-95 text-slate-950 font-bold rounded-lg shrink-0 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </aside>
            )}
          </>
        )}

        {/* Cashier Gateway View */}
        {activeTab === "cashier" && (
          <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto overflow-y-auto space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <Wallet className="w-7 h-7 text-sky-400" />
                <span>Trade Piles Financial Cashier</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Execute low-latency deposits and withdrawals supported by top global card processors and secure crypto blockchains.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Form Settings */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                
                {/* Mode Selectors */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-850">
                  <button
                    onClick={() => {
                      setCashierMode("deposit");
                      setCashierError("");
                      setCashierSuccess("");
                    }}
                    className={`py-2 text-xs font-bold rounded-md uppercase transition-all ${
                      cashierMode === "deposit"
                        ? "bg-slate-800 text-sky-400 shadow font-extrabold border border-slate-700"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Secure Deposit
                  </button>
                  <button
                    onClick={() => {
                      setCashierMode("withdraw");
                      setCashierError("");
                      setCashierSuccess("");
                    }}
                    className={`py-2 text-xs font-bold rounded-md uppercase transition-all ${
                      cashierMode === "withdraw"
                        ? "bg-slate-800 text-sky-400 shadow font-extrabold border border-slate-700"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Fast Withdrawal
                  </button>
                </div>

                {/* Gateway Form */}
                <form onSubmit={handleCashierAction} className="space-y-4">
                  {/* Select Payment Gateway */}
                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                      Select Global Gateway Method
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "Stripe Mastercard Gateway", name: "Stripe Debit/Credit" },
                        { id: "Bitcoin Lightning Protocol", name: "BTC Wallet Address" },
                        { id: "Visa Secure Pay Gateway", name: "Visa Dynamic Checkout" },
                        { id: "Tether USDT Network", name: "USDT Wallet Address" }
                      ].map((gw) => (
                        <div
                          key={gw.id}
                          onClick={() => setSelectedGateway(gw.id)}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between h-14 ${
                            selectedGateway === gw.id
                              ? "bg-sky-500/5 border-sky-500/40 text-sky-300 font-bold"
                              : "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-950/50"
                          }`}
                        >
                          <span className="font-extrabold leading-none">{gw.name}</span>
                          <span className="text-[9px] text-slate-500 font-medium tracking-wide font-mono uppercase">{gw.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cashier Amount */}
                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                      Amount to {cashierMode === "deposit" ? "Deposit" : "Withdraw"} (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-mono text-slate-500 text-sm font-bold">$</span>
                      <input
                        type="text"
                        value={cashierAmount}
                        onChange={(e) => setCashierAmount(e.target.value.replace(/[^\d.]/g, ""))}
                        placeholder="e.g. 100"
                        className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 pl-7 pr-3 text-sm font-mono font-bold text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Authorized Mobile Phone Number */}
                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                      Authorized Mobile Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={cashierPhoneNumber}
                      onChange={(e) => setCashierPhoneNumber(e.target.value)}
                      placeholder="e.g. +1 (555) 123-4567"
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2.5 px-3 text-sm font-sans font-semibold text-white focus:outline-none focus:border-sky-500 placeholder-slate-600"
                    />
                  </div>

                  {/* Conditional Fields for Withdrawal */}
                  {cashierMode === "withdraw" && (
                    <>
                      <div>
                        <label className="block text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                          Target Withdrawal Address / Card Account
                        </label>
                        <input
                          type="text"
                          value={withdrawalAddress}
                          onChange={(e) => setWithdrawalAddress(e.target.value)}
                          placeholder="e.g. bc1qxy2kgdygjr977..."
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 pl-3 pr-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      {/* 2FA input if 2FA is active */}
                      {is2faEnabled ? (
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                              2FA PROTECTION IS ACTIVE FOR CASHIER ACTIONS
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            A verification token is required to approve this cash withdrawal request. Please input your active 6-digit rolling code from the Security authenticator tab.
                          </p>
                          <input
                            type="text"
                            maxLength={6}
                            value={cashier2faCode}
                            onChange={(e) => setCashier2faCode(e.target.value.replace(/\D/g, ""))}
                            placeholder="6-digit verification code"
                            className="bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 font-mono text-center text-sm font-bold tracking-[0.25em] px-4 py-2 rounded-lg focus:outline-none focus:border-sky-500 w-full"
                          />
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg flex gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-amber-400 uppercase">Withdrawal Protection Limit</span>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                              Your account is currently lacking Two-Factor verification protection. Withdrawals are processed faster and with up to $50,000 daily limits once 2FA is configured.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {cashierError && (
                    <p className="text-xs text-rose-400 font-bold flex gap-1 items-center bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cashierError}</span>
                    </p>
                  )}

                  {cashierSuccess && (
                    <p className="text-xs text-emerald-400 font-bold flex gap-1 items-center bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{cashierSuccess}</span>
                    </p>
                  )}

                  {/* Place Transaction Submit button */}
                  <button
                    type="submit"
                    disabled={processingCashier}
                    className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-extrabold py-3 rounded-lg text-sm transition-all shadow-md active:scale-95 flex justify-center items-center gap-2 uppercase tracking-wide"
                  >
                    {processingCashier ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    <span>Confirm {cashierMode === "deposit" ? "Deposit Request" : "Withdrawal Transfer"}</span>
                  </button>
                </form>
              </div>

              {/* Right Column: Dynamic Status Info */}
              <div className="space-y-6">
                {/* Account Details Box */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account overview</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Main Demo Balance</span>
                      <span className="font-mono font-bold text-white">${balance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Protection Shield</span>
                      <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${is2faEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {is2faEnabled ? "PROTECTED" : "INACTIVE"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Connected Gateway IP</span>
                      <span className="font-mono text-slate-300">198.162.0.44</span>
                    </div>
                  </div>
                </div>

                {/* Gateway Trust Verification */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                  <span className="text-xs font-extrabold text-sky-400 uppercase tracking-wider">Payment safety pledge</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Trade Piles platform utilizes 3D-secure checks and fully verified ledger entries for deposits and withdrawals. Funds will reflect in your virtual balance instantly. For real accounts, processing speeds are guaranteed below 10 minutes worldwide.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction & Trades History View */}
        {activeTab === "history" && (
          <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto overflow-y-auto space-y-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <History className="w-7 h-7 text-sky-400" />
                <span>Trade Piles Transaction Log & Ledger</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Review and audit your historical contracts, deposit receipts, and withdrawal statuses resolved on Trade Piles platform.
              </p>
            </div>

            {/* Resolved and Active Trades Ledger */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 bg-[#12161F] border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Your Active Contracts ({activeTrades.length})</span>
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              </div>
              
              {activeTrades.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No active trading positions. Open positions in the Trading Terminal.</div>
              ) : (
                <div className="divide-y divide-slate-800/60 font-mono text-xs">
                  {activeTrades.map((t) => {
                    const progressSeconds = Math.max(0, Math.round((t.endTime - Date.now()) / 1000));
                    return (
                      <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-850/20 transition-all">
                        <div className="space-y-1">
                          <div className="font-sans font-bold text-slate-200 uppercase flex items-center gap-1.5">
                            <span>{t.assetName}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 rounded ${t.type === "rise" || t.type === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                              {t.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">ID: {t.id} • STAKE: ${t.stake.toFixed(2)}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-white font-bold">ENTRY: {t.entryPrice}</div>
                          <div className="text-[10px] text-sky-400 font-bold flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3 inline" />
                            <span>RESOLVING IN {progressSeconds} SECONDS</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resolved Trades Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 bg-[#12161F] border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Historical resolved contracts ({resolvedTrades.length})</span>
                <span className="text-xs text-slate-500 font-mono">DEMO DATABASE</span>
              </div>
              
              {resolvedTrades.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No resolved trading positions yet.</div>
              ) : (
                <div className="divide-y divide-slate-800/60 font-mono text-xs">
                  {resolvedTrades.map((t) => {
                    const isWin = t.status === "won";
                    return (
                      <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-850/20 transition-all">
                        <div className="space-y-1">
                          <div className="font-sans font-bold text-slate-200 uppercase flex items-center gap-1.5">
                            <span>{t.assetName}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 rounded ${t.type === "rise" || t.type === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                              {t.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">Stake: ${t.stake.toFixed(2)} • Expired: {new Date(t.endTime).toLocaleTimeString()}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-slate-400 font-bold">Entry: {t.entryPrice} • Exit: {t.exitPrice}</div>
                          <div className={`text-xs font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                            {isWin ? `WON: +$${t.payout?.toFixed(2)}` : "LOST (0.00)"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cashier Transactions Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 bg-[#12161F] border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Financial cashier audit log ({transactions.length})</span>
                <span className="text-xs text-sky-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> Secure Entries
                </span>
              </div>
              
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No transactions recorded yet. Use Cashier to deposit funds.</div>
              ) : (
                <div className="divide-y divide-slate-800/60 font-mono text-xs">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-850/20 transition-all">
                      <div className="space-y-1">
                        <div className="font-sans font-extrabold text-slate-200 uppercase flex items-center gap-1.5">
                          {tx.type === "deposit" ? (
                            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] font-extrabold">DEPOSIT SUCCESS</span>
                          ) : (
                            <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded text-[9px] font-extrabold">WITHDRAWAL COMPLETE</span>
                          )}
                          <span className="text-slate-400 font-medium font-mono text-[10px]">({tx.gateway})</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          TXID: {tx.id} • Hash: {tx.txHash || "Internal Settlement"}
                          {tx.phoneNumber && <span className="text-slate-400"> • Phone: {tx.phoneNumber}</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-white font-extrabold text-xs">
                          {tx.type === "deposit" ? "+" : "-"}${tx.amount.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Security / 2FA View */}
        {activeTab === "security" && (
          <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto overflow-y-auto space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <Shield className="w-7 h-7 text-sky-400" />
                <span>Trade Piles Security Vault</span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Configure two-factor authentication (2FA) and verify rotating OTP parameters to secure your financial withdrawals.
              </p>
            </div>

            <SecuritySettings
              is2faEnabled={is2faEnabled}
              twoFactorSecret={twoFactorSecret}
              onToggle2FA={handleToggle2FA}
            />
          </div>
        )}

      </div>

      {/* Bottom Status Footer Bar */}
      <footer className="h-8 bg-[#0B0E14] border-t border-slate-800 flex items-center justify-between px-4 shrink-0 text-[10px] font-semibold text-slate-500">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Market Correlation:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> SECURE CONNECTED
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Execution Delay:</span>
            <span className="text-slate-300 font-bold font-mono">{latency}ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">UTC Timestamp:</span>
            <span className="text-slate-300 font-bold font-mono">{currentTime || "Syncing..."}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>Server Cluster: TP-WEST-3</span>
          <span className="text-slate-400 bg-slate-900 border border-slate-850 px-1.5 rounded font-mono">v3.2.0-stable</span>
        </div>
      </footer>
    </div>
  );
}
