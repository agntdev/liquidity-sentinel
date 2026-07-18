// In-memory persistent storage for alerts and trades.
// In production, replace with toolkit's Redis-backed persistent store.
// The test harness creates a fresh bot per spec, so in-memory is fine for tests.

export interface AlertRecord {
  id: string;
  symbol: string;
  timeframe: string;
  price: number;
  signalType: string;
  buyInterest: number;
  sellInterest: number;
  dominanceScore: number;
  distancePips: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  timestamp: string;
}

export interface TradeRecord {
  id: string;
  alertId: string;
  symbol: string;
  timeframe: string;
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: "open" | "closed";
  outcome?: "TP" | "SL" | "Manual" | "Invalid";
  closedAt?: string;
}

// Module-level stores (in-memory). In production use Redis via toolkit.
const alertStore = new Map<string, AlertRecord>();
const alertIndex = new Map<string, string[]>(); // userId → alertId[]
const tradeStore = new Map<string, TradeRecord>();
const tradeIndex = new Map<string, string[]>(); // userId → tradeId[]

export function storeAlert(userId: string, alert: AlertRecord): void {
  alertStore.set(alert.id, alert);
  const ids = alertIndex.get(userId) ?? [];
  ids.unshift(alert.id);
  alertIndex.set(userId, ids.slice(0, 50));
}

export function getRecentAlerts(userId: string, limit = 5): AlertRecord[] {
  const ids = alertIndex.get(userId) ?? [];
  return ids.slice(0, limit).map((id) => alertStore.get(id)!).filter(Boolean);
}

export function getAlert(userId: string, alertId: string): AlertRecord | null {
  const ids = alertIndex.get(userId) ?? [];
  if (!ids.includes(alertId)) return null;
  return alertStore.get(alertId) ?? null;
}

export function storeTrade(userId: string, trade: TradeRecord): void {
  tradeStore.set(trade.id, trade);
  const ids = tradeIndex.get(userId) ?? [];
  ids.unshift(trade.id);
  tradeIndex.set(userId, ids.slice(0, 100));
}

export function getOpenTrades(userId: string): TradeRecord[] {
  const ids = tradeIndex.get(userId) ?? [];
  return ids
    .map((id) => tradeStore.get(id)!)
    .filter((t) => t && t.status === "open");
}

export function getTrade(userId: string, tradeId: string): TradeRecord | null {
  const ids = tradeIndex.get(userId) ?? [];
  if (!ids.includes(tradeId)) return null;
  return tradeStore.get(tradeId) ?? null;
}

export function updateTrade(userId: string, tradeId: string, updates: Partial<TradeRecord>): TradeRecord | null {
  const trade = getTrade(userId, tradeId);
  if (!trade) return null;
  Object.assign(trade, updates);
  tradeStore.set(tradeId, trade);
  return trade;
}
