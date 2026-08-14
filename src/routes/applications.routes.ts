import { Router } from "express";
import * as c from "../controllers/applications.controller";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { createApplicationSchema, updateApplicationSchema, listQuerySchema } from "../schemas";

export const applicationsRouter: import("express").Router = Router();

applicationsRouter.use(requireAuth);

// Declared before /:id so "stats" is not swallowed as an id.
applicationsRouter.get("/stats", c.stats);

applicationsRouter.get("/", validate(listQuerySchema, "query"), c.list);
applicationsRouter.post("/", validate(createApplicationSchema), c.create);
applicationsRouter.get("/:id", c.getOne);
applicationsRouter.patch("/:id", validate(updateApplicationSchema), c.update);
applicationsRouter.delete("/:id", c.remove);
