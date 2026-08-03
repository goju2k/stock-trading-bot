import { NextFunction, Request, Response } from 'express';

const HEADER = 'x-api-key';

// 실거래를 제어하는 API라서 fail-closed로 간다: API_TOKEN이 설정 안 돼있으면
// (배포 설정 실수 포함) 전부 막는다. 로컬 개발 시에도 .env.local에 값을 넣어야 열린다.
export function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.API_TOKEN;
  if (!expected) {
    res.status(500).json({ error: 'server misconfigured: API_TOKEN not set' });
    return;
  }
  if (req.header(HEADER) !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}