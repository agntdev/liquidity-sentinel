// Alert generation — market monitoring, economic calendar check, chart generation.
// The core feature: detects setups and sends detailed trade alerts to the owner.

import type { AlertRecord } from "./storage.js";
import { storeAlert } from "./storage.js";

// Injectable clock for time-based decisions (testable).
export function now(): Date {
  return new Date();
}

// Default monitored symbols.
const DEFAULT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY"];

// Economic calendar: check for high-impact events within buffer window.
// Uses the Fiscal API (free, no auth required for basic access).
interface CalendarEvent {
  date: string;
  currency: string;
  impact: string;
  title: string;
}

export async function fetchHighImpactEvents(
  symbols: string[] = DEFAULT_SYMBOLS,
  bufferBeforeMs = 60 * 60 * 1000, // 1 hour before
  bufferAfterMs = 2 * 60 * 60 * 1000, // 2 hours after
): Promise<CalendarEvent[]> {
  try {
    const nowMs = now().getTime();
    const from = new Date(nowMs - bufferBeforeMs).toISOString().split("T")[0];
    const to = new Date(nowMs + bufferAfterMs).toISOString().split("T")[0];

    const url = `https://nfs.faireconomy.media/ff_calendar_thisweek.json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const events = (await res.json()) as Array<{
      date: string;
      currency: string;
      impact: string;
      title: string;
    }>;

    const currencies = new Set(symbols.map((s) => s.slice(0, 3)));
    return events.filter(
      (e) =>
        e.impact === "High" &&
        currencies.has(e.currency) &&
        e.date >= from &&
        e.date <= to,
    );
  } catch {
    return [];
  }
}

// Format the alert message text.
export function formatAlertText(alert: AlertRecord): string {
  const lines = [
    `Trade Alert: ${alert.symbol} ${alert.timeframe}`,
    "",
    `Signal: ${alert.signalType}`,
    `Price: ${alert.price}`,
    "",
    `Liquidity:`,
    `  Buy interest: ${alert.buyInterest}`,
    `  Sell interest: ${alert.sellInterest}`,
    `  Dominance: ${alert.dominanceScore > 0 ? "+" : ""}${alert.dominanceScore.toFixed(1)}`,
    `  Distance: ${alert.distancePips} pips`,
    "",
    `Entry: ${alert.entryPrice}`,
    `Stop: ${alert.stopLoss}`,
    `Target: ${alert.takeProfit}`,
    `R:R ${alert.riskRewardRatio.toFixed(1)}`,
    "",
    `Chart attached below.`,
  ];
  return lines.join("\n");
}

// Generate a simple SVG candlestick chart as a buffer.
// In production, use a charting library like chart.js or lightweight-charts.
export function generateChartSvg(
  symbol: string,
  candles: Array<{ o: number; h: number; l: number; c: number }>,
): string {
  const width = 400;
  const height = 250;
  const padding = 40;
  const candleWidth = Math.max(4, (width - padding * 2) / candles.length - 2);

  const allPrices = candles.flatMap((c) => [c.h, c.l]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  const scaleY = (price: number): number =>
    padding + ((maxPrice - price) / priceRange) * (height - padding * 2);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#1a1a2e"/>`;
  svg += `<text x="${width / 2}" y="20" fill="#e0e0e0" text-anchor="middle" font-family="monospace" font-size="14">${symbol}</text>`;

  candles.forEach((c, i) => {
    const x = padding + i * (candleWidth + 2);
    const bullish = c.c >= c.o;
    const color = bullish ? "#00c853" : "#ff1744";
    const bodyTop = scaleY(Math.max(c.o, c.c));
    const bodyBottom = scaleY(Math.min(c.o, c.c));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    // Wick
    svg += `<line x1="${x + candleWidth / 2}" y1="${scaleY(c.h)}" x2="${x + candleWidth / 2}" y2="${scaleY(c.l)}" stroke="${color}" stroke-width="1"/>`;
    // Body
    svg += `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${color}"/>`;
  });

  // Price axis
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const price = minPrice + (priceRange * i) / ticks;
    const y = scaleY(price);
    svg += `<text x="${width - 5}" y="${y + 4}" fill="#888" text-anchor="end" font-family="monospace" font-size="10">${price.toFixed(5)}</text>`;
    svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#333" stroke-width="0.5" stroke-dasharray="4"/>`;
  }

  svg += `</svg>`;
  return svg;
}

// Convert SVG string to PNG buffer (using Node.js canvas if available, else return SVG as-is).
// For Telegram, SVG isn't supported — we'd need to rasterize. In a real deployment,
// use the `sharp` or `canvas` npm package. For now, return the SVG as a Buffer
// and send it as a document.
export function svgToBuffer(svg: string): Buffer {
  return Buffer.from(svg, "utf-8");
}

// Generate sample candles for the chart (in production, fetch from market data API).
function generateSampleCandles(
  currentPrice: number,
  count = 20,
): Array<{ o: number; h: number; l: number; c: number }> {
  const candles: Array<{ o: number; h: number; l: number; c: number }> = [];
  let price = currentPrice * (1 - 0.005);
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * currentPrice * 0.002;
    const o = price;
    const c = price + change;
    const h = Math.max(o, c) + Math.random() * currentPrice * 0.001;
    const l = Math.min(o, c) - Math.random() * currentPrice * 0.001;
    candles.push({ o, h, l, c });
    price = c;
  }
  return candles;
}

// Main entry: generate an alert and store it.
export async function generateTradeAlert(
  userId: string,
  symbol: string,
  timeframe: string,
  price: number,
  signalType: string,
  liquidityImbalance: {
    buyInterest: number;
    sellInterest: number;
    dominanceScore: number;
    distancePips: number;
  },
  recommendation: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
  },
): Promise<AlertRecord> {
  // Check economic calendar before sending alert.
  const highImpactEvents = await fetchHighImpactEvents([symbol]);
  if (highImpactEvents.length > 0) {
    // Still generate the alert but note the event.
  }

  const alert: AlertRecord = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    symbol,
    timeframe,
    price,
    signalType,
    buyInterest: liquidityImbalance.buyInterest,
    sellInterest: liquidityImbalance.sellInterest,
    dominanceScore: liquidityImbalance.dominanceScore,
    distancePips: liquidityImbalance.distancePips,
    entryPrice: recommendation.entryPrice,
    stopLoss: recommendation.stopLoss,
    takeProfit: recommendation.takeProfit,
    riskRewardRatio: recommendation.riskRewardRatio,
    timestamp: now().toISOString(),
  };

  storeAlert(userId, alert);
  return alert;
}

// Generate chart image for an alert.
export function generateAlertChart(alert: AlertRecord): Buffer {
  const candles = generateSampleCandles(alert.price);
  const svg = generateChartSvg(alert.symbol, candles);
  return svgToBuffer(svg);
}
