import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }
  // Duplicate key from the unique email index.
  if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: { code: "CONFLICT", message: "Already exists" } });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
};
