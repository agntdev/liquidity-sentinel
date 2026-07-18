import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getRecentAlerts, type AlertRecord } from "../storage.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";

// View Recent Alerts — shows the most recent trade alerts with summary details.
registerMainMenuItem({ label: "View Recent Alerts", data: "alerts:recent", order: 10 });

function formatAlertSummary(alert: AlertRecord, index: number): string {
  return [
    `${index + 1}. ${alert.symbol} ${alert.timeframe} — ${alert.signalType}`,
    `   Price: ${alert.price} | Entry: ${alert.entryPrice}`,
    `   Stop: ${alert.stopLoss} | Target: ${alert.takeProfit} | R:R ${alert.riskRewardRatio.toFixed(1)}`,
  ].join("\n");
}

const composer = new Composer<Ctx>();

composer.callbackQuery("alerts:recent", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = String(ctx.from?.id ?? 0);
  const alerts = getRecentAlerts(userId);

  if (alerts.length === 0) {
    await ctx.editMessageText(
      "No trade alerts yet — alerts will appear here when setups are detected.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const lines = ["Recent trade alerts:", ""];
  for (let i = 0; i < alerts.length; i++) {
    lines.push(formatAlertSummary(alerts[i], i));
    if (i < alerts.length - 1) lines.push("");
  }

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
