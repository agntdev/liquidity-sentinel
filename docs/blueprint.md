# Market Monitor Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private Telegram bot that monitors financial markets and sends detailed trade alerts to a single owner when the 'Neutral Fundamentals + Liquidity Imbalance Directional Trade' strategy identifies valid setups. Alerts include liquidity estimates, confirmation signals, stop/target levels, risk metrics, and chart snapshots.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Private trader

## Success criteria

- Bot sends accurate trade alerts with all required information when strategy conditions are met
- Owner receives alerts and follow-up notifications via Telegram
- Chart snapshots are included with each alert

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **View Recent Alerts** (button, actor: user, callback: alerts:recent) — Display the most recent trade alerts
  - outputs: List of recent alerts with summary details
- **Confirm Trade Opened** (button, actor: user, callback: trade:confirm_open) — Mark a trade as opened by the owner
  - inputs: Trade ID
  - outputs: Confirmation message
- **Report Trade Closed** (button, actor: user, callback: trade:report_close) — Report the outcome of a closed trade
  - inputs: Trade ID, Outcome type (TP/SL/Manual/Invalid)
  - outputs: Outcome confirmation and P/L details

## Flows

### Alert Generation
_Trigger:_ Market condition met

1. Detect liquidity imbalance and confirmation signal
2. Verify fundamentals are neutral and no high-impact events
3. Generate detailed alert message with chart
4. Send alert via Telegram

_Data touched:_ Market snapshot, Liquidity imbalance, Confirmation signal, Trade recommendation

### Trade Lifecycle Management
_Trigger:_ User interaction

1. Receive trade confirmation from owner
2. Track trade status
3. Send trade closed notification with outcome

_Data touched:_ Trade status, Trade outcome

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Market Snapshot** _(retention: persistent)_ — Captures price, timeframe, recent candles, and volume/order-flow metrics
  - fields: Symbol, Timeframe, Price, Candles, Volume, Order flow
- **Liquidity Imbalance** _(retention: session)_ — Represents aggregated buy vs sell interest and dominance score
  - fields: Buy interest, Sell interest, Dominance score, Distance from price
- **Confirmation Signal** _(retention: session)_ — Details about the candle pattern and supporting evidence
  - fields: Signal type, OHLC data, Volume/order flow evidence
- **Trade Recommendation** _(retention: persistent)_ — Direction, entry price, stop loss, take-profit, and risk metrics
  - fields: Direction, Entry price, Stop loss, Take-profit, Risk, Reward, RR ratio
- **Trade Outcome** _(retention: persistent)_ — Result of a closed trade including P/L
  - fields: Trade ID, Outcome type, P/L, Timestamp

## Integrations

- **Telegram** (required) — Bot API messaging
- **Economic Calendar API** (required) — Check for high-impact events
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure monitored markets
- Set timeframes for analysis
- Adjust fundamental filter parameters
- View trade history and alerts

## Notifications

- New trade alert with chart snapshot
- Trade opened confirmation request
- Trade closed notification with outcome

## Permissions & privacy

- Bot only communicates with the owner's Telegram account
- No user data is stored beyond trade records and market snapshots
- Chart images are generated and sent but not stored

## Edge cases

- No liquidity imbalance detected for extended periods
- Multiple confirmation signals on different timeframes
- High-impact event occurs during trade execution
- Owner fails to confirm trade opening within expected timeframe

## Required tests

- Verify alert is sent with all required information when conditions are met
- Test trade lifecycle management with manual confirmations
- Validate chart snapshot generation and inclusion in alerts

## Assumptions

- Markets monitored default to major FX pairs (EURUSD, GBPUSD, USDJPY)
- Timeframes used are 4H/1H/15M for setup and 1M for confirmation
- Fundamental filter uses 1-hour before to 2-hour after buffer for high-impact events
- Liquidity estimation uses relative units for interest and pips for distance
