import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4는 async 핸들러 내부에서 던진 에러를 자동으로 next()에 넘기지 않는다.
// 이 래퍼로 감싸서 reject된 프로미스가 조용히 unhandled rejection으로 사라지지 않게 한다.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}