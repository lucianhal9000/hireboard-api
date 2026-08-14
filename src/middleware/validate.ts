import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { badRequest } from "../utils/errors";

type Source = "body" | "query";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validQuery?: Record<string, unknown>;
    }
  }
}

/**
 * Validates and coerces a request body or query string.
 *
 * Express 5 exposes req.query as a getter, so the parsed result cannot be
 * assigned back onto it the way Express 4 allowed. Query output is attached to
 * req.validQuery instead; bodies are still replaced in place.
 */
export const validate =
  (schema: ZodTypeAny, source: Source = "body"): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return next(badRequest("Request validation failed", details));
    }
    if (source === "body") {
      req.body = result.data;
    } else {
      req.validQuery = result.data as Record<string, unknown>;
    }
    next();
  };
