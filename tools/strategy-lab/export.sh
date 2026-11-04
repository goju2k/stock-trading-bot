#!/usr/bin/env bash
# DB(my_postgres 컨테이너)에서 분석 입력 CSV를 다시 뽑는다. 사용: ./export.sh 2026-10-06 2026-10-30 [출력폴더]
# positions.csv: watcher id, sessionDate, code, orderedAt, closedAt, entry, qty, highOrLow, pnl, sellPrice, priceAt60s, peakPrice
# ticks.csv:     positionWatcherId, observedAt, price            (position_price_ticks, 매도 시점까지)
# bars.csv:      code, date, time, open, high, low, close, volume (minute_bars, 정규장 전체)
# entries.csv:   watcher id, Order.buyPrice(스캔 시점 가격), kospiDeltaAtBuy, headlineSentiment, firstTickPrice
# snapshots.jsonl: watcher id별 Order.scanSnapshot (volume_rank 매수 시점 순위표 행)
# 시각은 전부 DB 그대로(UTC, 타임존 없음). entry = sellAmtHigh / (1 + highPercentage/100).
set -euo pipefail
FROM=${1:?from YYYY-MM-DD}; TO=${2:?to YYYY-MM-DD}
OUT=${3:-$(dirname "$0")}
mkdir -p "$OUT" && cd "$OUT"
psql() { docker exec -i my_postgres psql -U goju2k -d stock_trading -At -F, "$@"; }

psql <<SQL > positions.csv
select w.id, s."sessionDate", o.code, o."orderedAt", coalesce(w."closedAt"::text, ''),
  round((w."sellAmtHigh" / (1 + w."highPercentage" / 100.0))::numeric, 4), coalesce(w."sellQty", o.qty),
  coalesce(w."highOrLow", ''), coalesce(w.pnl::text, ''), coalesce(w."sellPrice"::text, ''),
  coalesce(w."priceAt60s"::text, ''), coalesce(w."peakPrice"::text, '')
from orders o join trading_sessions s on s.id = o."sessionId" join position_watchers w on w."orderId" = o.id
where s."sessionDate" between '$FROM' and '$TO' and o."sourceStrategy" = 'volume_rank'
order by o."orderedAt";
SQL

psql <<SQL > ticks.csv
select t."positionWatcherId", t."observedAt", t.price
from position_price_ticks t join position_watchers w on w.id = t."positionWatcherId" join orders o on o.id = w."orderId"
join trading_sessions s on s.id = o."sessionId"
where s."sessionDate" between '$FROM' and '$TO'
order by t."positionWatcherId", t."observedAt";
SQL

psql <<SQL > bars.csv
select code, date, time, open, high, low, close, volume from minute_bars
where date between replace('$FROM', '-', '') and replace('$TO', '-', '')
order by code, date, time;
SQL

psql <<SQL > entries.csv
select w.id, o."buyPrice", coalesce(o."kospiDeltaAtBuy"::text, ''), coalesce(o."headlineSentiment", ''), coalesce(w."firstTickPrice"::text, '')
from orders o join trading_sessions s on s.id = o."sessionId" join position_watchers w on w."orderId" = o.id
where s."sessionDate" between '$FROM' and '$TO' and o."sourceStrategy" = 'volume_rank';
SQL

psql <<SQL > snapshots.jsonl
select json_build_object('id', w.id, 'snap', o."scanSnapshot")
from orders o join trading_sessions s on s.id = o."sessionId" join position_watchers w on w."orderId" = o.id
where s."sessionDate" between '$FROM' and '$TO' and o."scanSnapshot" is not null;
SQL

wc -l positions.csv ticks.csv bars.csv entries.csv snapshots.jsonl
