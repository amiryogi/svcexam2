import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { env, isProd } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { loadSession, requireAuth } from './middleware/auth.js';
import { csrfProtect, originCheck } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { academicYearsRouter, streamsRouter } from './modules/academic/academic.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { auditRouter, dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { enrollmentsRouter } from './modules/enrollments/enrollments.routes.js';
import { examsRouter } from './modules/exams/exams.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { studentsRouter } from './modules/students/students.routes.js';
import { curriculumRouter, gradeScalesRouter, subjectsRouter } from './modules/subjects/subjects.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string | undefined)?.slice(0, 64) ?? randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] },
      },
      hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const api = Router();
  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  api.use(apiLimiter, originCheck, loadSession, csrfProtect);
  api.use('/auth', authRouter);

  // Everything below requires a signed-in admin.
  api.use(requireAuth);
  api.use('/users', usersRouter);
  api.use('/settings', settingsRouter);
  api.use('/academic-years', academicYearsRouter);
  api.use('/streams', streamsRouter);
  api.use('/subjects', subjectsRouter);
  api.use('/curriculum', curriculumRouter);
  api.use('/grade-scales', gradeScalesRouter);
  api.use('/students', studentsRouter);
  api.use('/enrollments', enrollmentsRouter);
  api.use('/exams', examsRouter);
  api.use('/reports', reportsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/audit', auditRouter);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
