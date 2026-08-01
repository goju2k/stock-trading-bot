export type KisEnvName = 'paper' | 'real';

export interface StatusResponse {
  kisEnv: KisEnvName | null;
  scannerRunning: boolean;
  viScannerRunning: boolean;
  gapScannerRunning: boolean;
  activeWatcherCount: number;
  session: {
    date: string;
    isBusinessDay: boolean;
    openedAt: string | null;
    liquidationAt: string | null;
    closedAt: string | null;
  } | null;
}

export interface TradingConfig {
  id: number;
  refreshRateMs: number;
  highPercentage: number;
  lowPercentage: number;
  maxOrderAmt: number;
  minTargetAmt: number;
  minTradingCount: number;
  targetUpRating: number;
  targetIncreaseRate: number;
  kisEnv: KisEnvName;
  autoTradingEnabled: boolean;
  requireForeignInstitutionNetBuy: boolean;
  viStrategyEnabled: boolean;
  gapStrategyEnabled: boolean;
  gapUpThresholdPercent: number;
  gapScanWindowMinutes: number;
  updatedAt: string;
}

export type PositionState = 'checking' | 'watching_for_sell' | 'sell_waiting' | 'done' | 'error';

export interface Position {
  code: string;
  name: string | null;
  state: PositionState;
  buyPrice: string;
  qty: number;
  sellAmtHigh: string | null;
  sellAmtLow: string | null;
  highOrLow: string | null;
  stateMessage: string | null;
  updatedAt: string;
}

export interface Order {
  id: number;
  sessionId: number;
  code: string;
  name: string | null;
  buyPrice: string;
  qty: number;
  kisOrderNo: string | null;
  sourceStrategy: string;
  orderedAt: string;
}

export type TradeEventType =
  | 'session_start'
  | 'session_end'
  | 'buy_executed'
  | 'buy_failed'
  | 'sell_executed'
  | 'sell_failed'
  | 'forced_liquidation'
  | 'error';

export interface TradeEvent {
  id: number;
  sessionId: number | null;
  type: TradeEventType;
  code: string | null;
  message: string;
  payload: unknown;
  createdAt: string;
}