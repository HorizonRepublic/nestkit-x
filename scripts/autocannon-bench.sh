
#!/bin/bash

# Конфігурація
URL="${1:-http://0.0.0.0:3000/}"
CONNECTIONS="${2:-100}"
DURATION="${3:-30}"

echo "🚀 Starting load test..."
echo "   URL:          $URL"
echo "   Connections:  $CONNECTIONS"
echo "   Duration:     ${DURATION}s"
echo ""

# Запускаємо autocannon
autocannon \
  --connections $CONNECTIONS \
  --duration $DURATION \
  --pipelining 1 \
  --method GET \
  "$URL"

# Чекаємо 2 секунди на обробку повідомлень
echo ""
echo "⏳ Waiting 2 seconds for message processing..."
sleep 2

# Отримуємо статистику з сервера
echo ""
echo "📈 Fetching server statistics..."
echo ""

STATS_URL="${URL%/}/stats"
curl -s "$STATS_URL" | jq '
  "═══════════════════════════════════════════════════════",
  "📊 SERVER MESSAGE STATISTICS:",
  "═══════════════════════════════════════════════════════",
  "⏱️  Uptime:           \(.uptime)s",
  "",
  "📨 EVENTS:",
  "   Sent:             \(.events.sent)",
  "   Received:         \(.events.received)",
  "   Lost:             \(.events.lost)",
  "   Success Rate:     \(.events.successRate)%",
  "",
  "🔄 RPC:",
  "   Sent:             \(.rpc.sent)",
  "   Received:         \(.rpc.received)",
  "   Lost:             \(.rpc.lost)",
  "   Success Rate:     \(.rpc.successRate)%",
  "",
  "⚡ THROUGHPUT:",
  "   Events Sent:      \(.throughput.eventsSentPerSec | tonumber | floor)/s",
  "   Events Received:  \(.throughput.eventsReceivedPerSec | tonumber | floor)/s",
  "   RPC Sent:         \(.throughput.rpcSentPerSec | tonumber | floor)/s",
  "   RPC Received:     \(.throughput.rpcReceivedPerSec | tonumber | floor)/s",
  "═══════════════════════════════════════════════════════"
' -r

echo ""