#!/usr/bin/env python3
"""on-chainDAT ops monitor (GitHub Actions cron).

Routing:
  - platform checks (site, /api/snapshot)        -> @onchainDAT_Status_bot  (TG_TOKEN_STATUS)
  - per-DAT checks (keeper, indexer, bag/burn)   -> that DAT's own bot      (e.g. TG_TOKEN_LINEADAT)

Adding a future DAT = one entry in DATS + one TG_TOKEN_* repo secret.

State (previous lastBagId, alert timestamps) persists between runs via
actions/cache on state/monitor-state.json. Alerts re-fire at most every
REALERT_MIN while a condition stays broken; a recovery message is sent
when it clears. All checks are free endpoints (Fly /status, CDN snapshot,
site HTML) - the monitor never spends Infura credits.
"""
import json
import os
import time
import urllib.request

CHAT_ID = os.environ["TG_CHAT_ID"]
STATE_PATH = "state/monitor-state.json"
REALERT_MIN = 30
KEEPER_ETH_MIN = 0.1
KEEPER_STALE_S = 240

SITE_URL = "https://www.on-chaindat.com"
SNAPSHOT_URL = "https://www.on-chaindat.com/api/snapshot"

DATS = [
    {
        "name": "LineaDAT",
        "token_env": "TG_TOKEN_LINEADAT",
        "keeper": "https://lineadat-keeper.fly.dev/status",
        "indexer_healthz": "https://lineadat-indexer.fly.dev/healthz",
    },
]


def fetch(url, timeout=20):
    """Return (http_status, parsed_json_or_None). Network errors -> (0, None)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read()
            try:
                return r.status, json.loads(body)
            except Exception:
                return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None


def send(token, text):
    data = json.dumps({"chat_id": CHAT_ID, "text": text}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"content-type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        print(f"telegram send failed: {e}")


def load_state():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except Exception:
        return {"alerts": {}, "dats": {}}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w") as f:
        json.dump(state, f)


class Alerter:
    """Dedup: alert -> silence REALERT_MIN -> re-alert if still broken; recovery note on clear."""

    def __init__(self, state):
        self.alerts = state.setdefault("alerts", {})
        self.now = time.time()

    def check(self, token, key, broken, text):
        prev = self.alerts.get(key)
        if broken:
            if prev is None or self.now - prev > REALERT_MIN * 60:
                send(token, f"🔴 {text}")
                self.alerts[key] = self.now
        elif prev is not None:
            send(token, f"🟢 восстановилось: {key}")
            del self.alerts[key]


def main():
    ping = os.environ.get("PING") == "true"
    state = load_state()
    al = Alerter(state)
    status_token = os.environ["TG_TOKEN_STATUS"]

    # --- platform -> status bot ---
    site_code, _ = fetch(SITE_URL)
    al.check(status_token, "site", site_code != 200, f"сайт on-chaindat.com отвечает {site_code or 'timeout'} (не 200)")

    snap_code, snap = fetch(SNAPSHOT_URL)
    snap_ok = snap_code == 200 and isinstance(snap, dict) and "availableFunds" in snap
    al.check(status_token, "snapshot", not snap_ok, f"/api/snapshot сломан (http {snap_code or 'timeout'})")

    if ping:
        send(status_token, "🧪 монитор задеплоен и работает (платформенный канал). Проверяю сайт + snapshot каждые ~5 минут.")

    # --- per-DAT -> own bot ---
    for dat in DATS:
        token = os.environ[dat["token_env"]]
        name = dat["name"]
        dstate = state.setdefault("dats", {}).setdefault(name, {})

        k_code, k = fetch(dat["keeper"])
        k_ok = k_code == 200 and isinstance(k, dict)
        al.check(token, f"{name}: keeper http", not k_ok, f"{name}: keeper /status недоступен (http {k_code or 'timeout'})")

        if k_ok:
            al.check(token, f"{name}: keeper alive", not k.get("alive"), f"{name}: кипер сообщает alive=false")
            err = k.get("lastError")
            al.check(token, f"{name}: keeper error", bool(err), f"{name}: кипер lastError: {str(err)[:160]}")
            try:
                age = time.time() - time.mktime(time.strptime(k["updatedAt"][:19], "%Y-%m-%dT%H:%M:%S"))
                al.check(token, f"{name}: keeper stale", age > KEEPER_STALE_S, f"{name}: кипер не обновлял статус {int(age)}с (>{KEEPER_STALE_S}с) - возможно, процесс завис")
            except Exception:
                pass
            try:
                eth = float(k.get("keeperEth") or 0)
                al.check(token, f"{name}: keeper balance", eth < KEEPER_ETH_MIN, f"{name}: баланс кипера {eth:.4f} ETH < {KEEPER_ETH_MIN} - BUY встанут, нужен долив")
            except Exception:
                pass

            # good news: new bag bought
            try:
                bag = int(k.get("lastBagId") or 0)
                prev_bag = int(dstate.get("lastBagId") or 0)
                if prev_bag and bag > prev_bag:
                    send(token, f"💰 {name}: куплен новый бэг #{bag} (было #{prev_bag}). availableFunds обнулились, копим дальше.")
                dstate["lastBagId"] = bag
            except Exception:
                pass

            # good news: first TWAP burn cycle started (ethToTwap went 0 -> >0) and burns
            try:
                twap = float(k.get("ethToTwapEth") or 0)
                if twap > 0 and not dstate.get("twapSeen"):
                    send(token, f"🔥 {name}: появился ethToTwap = {twap:.4f} ETH - бэг продан, скоро первый burn.")
                    dstate["twapSeen"] = True
            except Exception:
                pass

        i_code, _ = fetch(dat["indexer_healthz"])
        al.check(token, f"{name}: indexer", i_code != 200, f"{name}: индексер healthz {i_code or 'timeout'} (таблицы на сайте перестанут обновляться)")

        if ping:
            send(token, f"🧪 монитор задеплоен и работает (канал {name}). Слежу за кипером, индексером, бэгами и burn'ами каждые ~5 минут.")

    save_state(state)
    print("monitor run complete; alerts state:", list(state.get("alerts", {}).keys()) or "all green")


if __name__ == "__main__":
    main()
