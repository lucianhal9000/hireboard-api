import type { RequestHandler } from "express";
import { verifyAccessToken } from "../services/tokens";
import { unauthorized } from "../utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next(unauthorized());
  try {
    req.userId = verifyAccessToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
};
