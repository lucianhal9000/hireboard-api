export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError(400, "BAD_REQUEST", m, d);
export const unauthorized = (m = "Authentication required") => new AppError(401, "UNAUTHORIZED", m);
export const notFound = (m = "Resource not found") => new AppError(404, "NOT_FOUND", m);
export const conflict = (m: string) => new AppError(409, "CONFLICT", m);
