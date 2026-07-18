import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getOpenTrades, updateTrade } from "../storage.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { now } from "../alert-generation.js";

// Report Trade Closed — lets the owner report the outcome of a closed trade.
registerMainMenuItem({ label: "Report Trade Closed", data: "trade:report_close", order: 30 });

const composer = new Composer<Ctx>();

composer.callbackQuery("trade:report_close", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = String(ctx.from?.id ?? 0);
  const openTrades = getOpenTrades(userId);

  if (openTrades.length === 0) {
    await ctx.editMessageText(
      "No open trades to close — confirm a trade first.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const rows = openTrades.slice(0, 5).map((t) => [
    inlineButton(
      `${t.symbol} ${t.timeframe} — ${t.direction}`,
      `report_close:${t.id}`,
    ),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText("Select a trade to report as closed:", {
    reply_markup: inlineKeyboard(rows),
  });
});

// Handle trade selection — ask for outcome type.
composer.callbackQuery(/^report_close:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = String(ctx.from?.id ?? 0);
  const tradeId = ctx.match?.[1];
  if (!tradeId) return;

  const openTrades = getOpenTrades(userId);
  const trade = openTrades.find((t) => t.id === tradeId);
  if (!trade) {
    await ctx.editMessageText(
      "That trade is no longer open.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  ctx.session.step = "reporting_close";
  ctx.session.pendingTradeId = tradeId;

  await ctx.editMessageText(
    `How did ${trade.symbol} ${trade.timeframe} close?`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("Take Profit", `outcome:${tradeId}:TP`),
          inlineButton("Stop Loss", `outcome:${tradeId}:SL`),
        ],
        [
          inlineButton("Manual Close", `outcome:${tradeId}:Manual`),
          inlineButton("Invalidated", `outcome:${tradeId}:Invalid`),
        ],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

// Handle outcome selection — record and confirm.
composer.callbackQuery(/^outcome:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = String(ctx.from?.id ?? 0);
  const tradeId = ctx.match?.[1];
  const outcome = ctx.match?.[2] as "TP" | "SL" | "Manual" | "Invalid";
  if (!tradeId || !outcome) return;

  ctx.session.step = "idle";
  ctx.session.pendingTradeId = undefined;

  const trade = updateTrade(userId, tradeId, {
    status: "closed",
    outcome,
    closedAt: now().toISOString(),
  });

  if (!trade) {
    await ctx.editMessageText(
      "Couldn't find that trade — it may have already been closed.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const outcomeLabel =
    outcome === "TP" ? "Take Profit" :
    outcome === "SL" ? "Stop Loss" :
    outcome === "Manual" ? "Manual Close" :
    "Invalidated";

  await ctx.editMessageText(
    [
      `Trade closed: ${trade.symbol} ${trade.timeframe}`,
      `Outcome: ${outcomeLabel}`,
      `Direction: ${trade.direction}`,
      `Entry: ${trade.entryPrice}`,
      `Stop: ${trade.stopLoss}`,
      `Target: ${trade.takeProfit}`,
    ].join("\n"),
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

export default composer;
