# Always-on ops monitor (Fly worker). Single source of truth is
# .github/scripts/monitor.py - the SAME script GitHub Actions runs one-shot.
# Build context is the repo root: fly deploy . --config automation/monitor/fly.toml
FROM python:3.12-slim
# ca-certificates is mandatory: without it urllib's HTTPS verify fails and the
# monitor would see every endpoint as down and spam false "🔴 outage" alerts.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY .github/scripts/monitor.py .
ENV MONITOR_LOOP=true
# -u: unbuffered stdout so `fly logs` shows iterations live (stdlib only, no deps)
CMD ["python", "-u", "monitor.py"]
