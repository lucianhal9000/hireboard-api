import { Router } from "express";
import * as c from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { registerSchema, loginSchema, refreshSchema } from "../schemas";

export const authRouter: import("express").Router = Router();

authRouter.post("/register", validate(registerSchema), c.register);
authRouter.post("/login", validate(loginSchema), c.login);
authRouter.post("/refresh", validate(refreshSchema), c.refresh);
authRouter.post("/logout", validate(refreshSchema), c.logout);
authRouter.get("/me", requireAuth, c.me);
