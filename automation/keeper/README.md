# LINEASTR Self-Hosted Keeper

Replaces unreliable GitHub Actions cron and deprecated Gelato W3F. Runs on
Fly.io as an always-on machine for ~$2/mo (shared-cpu-1x, 256MB).

## What it does

Every 30 minutes (configurable via `CRON_SCHEDULE`):

1. Reads strategy state (`currentFees`, `availableFunds`, `ethToTwap`, `lastBagId`)
2. Decides if `bot.executeRound()` would be productive:
   - `availableFunds >= BUY_THRESHOLD_WEI` → bot can buy a bag
   - `ethToTwap > 0` → TWAP burn pending
3. Sends `executeRound(roundId)` if either condition holds, else logs no-op

No state persistence — the bot contract itself is source of truth on whether
the round actually does anything. Skipping is just a gas optimization.

## Local test (single tick)

```bash
cd automation/keeper
cp .env.example .env
# fill in KEEPER_PK
npm install
npm run tick   # one-off execution, exits after one round
```

## Deploy to Fly.io (Base Sepolia)

```bash
# 1. install flyctl if missing
brew install flyctl
fly auth login

# 2. launch app (creates app, doesn't deploy yet)
cd automation/keeper
fly launch --no-deploy --copy-config --name lineastr-keeper

# 3. push secrets (NEVER commit these)
fly secrets set \
  RPC_URL="https://base-sepolia-rpc.publicnode.com" \
  KEEPER_PK="0xYOUR_KEEPER_PRIVATE_KEY" \
  STRATEGY_ADDR="0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2" \
  BOT_ADDR="0x5CAbfF553d8D7B9564CceE758A22b58c850d23Fc"

# 4. deploy
fly deploy

# 5. tail logs
fly logs
```

Expected log output:

```
LINEASTR keeper start chain=base-sepolia strategy=0x6ddb... bot=0x5CAb... cron=*/30 * * * *
[2026-05-04T01:30:00.000Z] tick#1 state chain=base-sepolia fees=0.0152 funds=0.0152 twap=0.0 bagId=4 signerBal=0.0421
[2026-05-04T01:30:00.000Z] tick#1 no-op: nothing to do
[2026-05-04T02:00:00.000Z] tick#2 state ...
[2026-05-04T02:00:00.000Z] tick#2 executeRound(1746320400000000002) reasons=[funds>=0.001]
[2026-05-04T02:00:00.000Z] tick#2 sent tx=0xabc... nonce=42
[2026-05-04T02:00:00.000Z] tick#2 mined block=12345678 gasUsed=287142 status=1
```

## Phase 4 mainnet migration

When ready to migrate to Linea mainnet:

```bash
fly secrets set \
  RPC_URL="https://rpc.linea.build" \
  STRATEGY_ADDR="0xLINEA_MAINNET_STRATEGY" \
  BOT_ADDR="0xLINEA_MAINNET_BOT" \
  CHAIN_NAME="linea-mainnet"

fly deploy
```

Top up keeper EOA with real ETH on Linea (~0.01 ETH covers thousands of rounds
at ~8 gwei).

## Security notes

- `KEEPER_PK` lives only in Fly secrets, never on disk in plaintext, never in
  git, never in logs
- Keeper EOA only has permission to call `bot.executeRound`. It cannot drain
  the strategy or move LINEASTR
- If keeper key is leaked: rotate the key in `.env` + `fly secrets set` +
  `fly deploy`. The bot contract has no admin coupling to keeper.

## Disabling the legacy GitHub Actions keeper

Once Fly.io deployment is confirmed running for 24h:

```bash
gh workflow disable "LINEASTR Keeper"
```

Or via UI: Repo → Actions → "LINEASTR Keeper" → ⋯ → Disable workflow.
