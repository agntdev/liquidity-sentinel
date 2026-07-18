import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getRecentAlerts, storeTrade, getOpenTrades } from "../storage.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";

// Confirm Trade Opened — lets the owner mark a trade alert as opened.
registerMainMenuItem({ label: "Confirm Trade Opened", data: "trade:confirm_open", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("trade:confirm_open", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = String(ctx.from?.id ?? 0);
  const alerts = getRecentAlerts(userId, 10);
  const openTrades = getOpenTrades(userId);
  const openAlertIds = new Set(openTrades.map((t) => t.alertId));
  const unconfirmed = alerts.filter((a) => !openAlertIds.has(a.id));

  if (unconfirmed.length === 0) {
    await ctx.editMessageText(
      "No unconfirmed alerts right now — new setups will appear here.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const rows = unconfirmed.slice(0, 5).map((a) => [
    inlineButton(
      `${a.symbol} ${a.timeframe} — ${a.signalType}`,
      `confirm_open:${a.id}`,
    ),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText("Select an alert to confirm as opened:", {
    reply_markup: inlineKeyboard(rows),
  });
});

// Handle alert selection — mark trade as opened.
composer.callbackQuery(/^confirm_open:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = String(ctx.from?.id ?? 0);
  const alertId = ctx.match?.[1];
  if (!alertId) return;

  const alerts = getRecentAlerts(userId, 10);
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) {
    await ctx.editMessageText(
      "That alert is no longer available.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const tradeId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  storeTrade(userId, {
    id: tradeId,
    alertId: alert.id,
    symbol: alert.symbol,
    timeframe: alert.timeframe,
    direction: alert.signalType,
    entryPrice: alert.entryPrice,
    stopLoss: alert.stopLoss,
    takeProfit: alert.takeProfit,
    status: "open",
  });

  await ctx.editMessageText(
    [
      `Trade opened: ${alert.symbol} ${alert.timeframe}`,
      `Direction: ${alert.signalType}`,
      `Entry: ${alert.entryPrice}`,
      `Stop: ${alert.stopLoss}`,
      `Target: ${alert.takeProfit}`,
      "",
      "Use \u201CReport Trade Closed\u201D when you exit the position.",
    ].join("\n"),
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

export default composer;
