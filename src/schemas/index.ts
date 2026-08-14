import { z } from "zod";
import { STATUSES } from "../models/Application";

export const registerSchema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().min(1, "Name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const createApplicationSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  status: z.enum(STATUSES).optional(),
  location: z.string().max(200).optional(),
  url: z.string().url().optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  appliedAt: z.coerce.date().optional(),
});

export const updateApplicationSchema = createApplicationSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const listQuerySchema = z.object({
  status: z.string().optional(),
  company: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
