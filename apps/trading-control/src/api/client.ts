import { Order, Position, StatusResponse, TradeEvent, TradingConfig } from './types';

import envConstants from '../env-constants';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${envConstants.VITE_TRADING_SERVER_HOST}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-api-key': envConstants.VITE_TRADING_SERVER_API_TOKEN,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (HTTP ${res.status})`);
  }

  return res.json();
}

export const getStatus = () => request<StatusResponse>('/api/status');

export const getConfig = () => request<TradingConfig>('/api/config');

export const updateConfig = (data: Partial<TradingConfig>) => request<TradingConfig>('/api/config', {
  method: 'PUT',
  body: JSON.stringify(data),
});

export const getPositions = () => request<Position[]>('/api/positions');

export const forceSell = (code: string) => request<{ ok: boolean; }>(`/api/positions/${code}/force-sell`, { method: 'POST' });

export const getOrders = (date?: string) => request<Order[]>(`/api/orders${date ? `?date=${date}` : ''}`);

export const getEvents = (limit = 100) => request<TradeEvent[]>(`/api/events?limit=${limit}`);