import { Router } from 'express';

import { requireApiToken } from './auth-middleware';
import { configRouter } from './routes/config';
import { devicesRouter } from './routes/devices';
import { eventsRouter } from './routes/events';
import { minuteBarsRouter } from './routes/minute-bars';
import { ordersRouter } from './routes/orders';
import { positionsRouter } from './routes/positions';
import { sessionRouter } from './routes/session';
import { statusRouter } from './routes/status';

export const apiRouter = Router();

apiRouter.use(requireApiToken);
apiRouter.use('/status', statusRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/positions', positionsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/session', sessionRouter);
apiRouter.use('/minute-bars', minuteBarsRouter);