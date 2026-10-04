import type { AuthUser } from '@svi/shared';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: AuthUser;
        session: { id: number; csrfToken: string };
      };
    }
  }
}

export {};
