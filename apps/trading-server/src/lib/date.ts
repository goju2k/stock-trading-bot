export function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function todayYYYYMMDD() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}${mm}${dd}`;
}

// KIS 응답의 HHMMSS 시각 필드와 비교하기 위한 헬퍼 (vi-scanner.ts).
export function nowHHMMSS() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}${mi}${ss}`;
}

export function hhmmssDiffSeconds(a: string, b: string) {
  const toSeconds = (value: string) => (
    Number(value.slice(0, 2)) * 3600 + Number(value.slice(2, 4)) * 60 + Number(value.slice(4, 6))
  );
  return Math.abs(toSeconds(a) - toSeconds(b));
}