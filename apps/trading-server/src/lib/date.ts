const TIMEZONE = 'Asia/Seoul';

// 세션 날짜/시각 계산은 전부 KST 기준이어야 한다(장 운영시간, KIS 필드가 전부 KST).
// new Date()의 로컬 getter(getFullYear/getHours 등)는 프로세스/컨테이너의 시스템 TZ를 따라가는데,
// 이 레포 어디에도(Dockerfile, Jenkins 배포 커맨드) TZ를 명시적으로 고정하는 곳이 없다 - 지금은
// 우연히 맞아떨어지고 있을 뿐이라 호스트/이미지가 바뀌면 조용히 깨질 수 있다. 그래서 시스템 TZ와
// 무관하게 항상 Asia/Seoul로 계산하도록 Intl.DateTimeFormat으로 명시했다.
const kstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23', // hour12:false만 쓰면 자정에 "24"를 반환하는 ICU 구현이 있어 h23으로 명시
});

function kstParts(date: Date) {
  const parts: Record<string, string> = {};
  kstFormatter.formatToParts(date).forEach((part) => {
    parts[part.type] = part.value;
  });
  return parts as { year: string; month: string; day: string; hour: string; minute: string; second: string; };
}

export function todayDateOnly() {
  const { year, month, day } = kstParts(new Date());
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function todayYYYYMMDD() {
  const { year, month, day } = kstParts(new Date());
  return `${year}${month}${day}`;
}

// KIS 응답의 HHMMSS 시각 필드와 비교하기 위한 헬퍼 (vi-scanner.ts) - KIS 필드 자체가 KST라
// 여기도 반드시 KST로 계산해야 한다.
export function nowHHMMSS() {
  const { hour, minute, second } = kstParts(new Date());
  return `${hour}${minute}${second}`;
}

// 로그에 찍을 KST 타임스탬프 (lib/logger.ts). "YYYY-MM-DD HH:MM:SS" - 프로세스 시스템 TZ와
// 무관하게 항상 KST로 찍혀야 배포 서버 로그를 보면서 장 운영시간(09:00/15:15/15:30)과 바로
// 대조할 수 있다.
export function nowKstTimestamp() {
  const { year, month, day, hour, minute, second } = kstParts(new Date());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function hhmmssDiffSeconds(a: string, b: string) {
  const toSeconds = (value: string) => (
    Number(value.slice(0, 2)) * 3600 + Number(value.slice(2, 4)) * 60 + Number(value.slice(4, 6))
  );
  return Math.abs(toSeconds(a) - toSeconds(b));
}
