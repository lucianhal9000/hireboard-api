import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { ApplicationModel, type Status } from "../models/Application";
import { invalidateStats } from "../services/cache";
import { getStats } from "../services/stats.service";
import { notFound } from "../utils/errors";

interface ListQuery {
  status?: string;
  company?: string;
  tag?: string;
  q?: string;
  sort?: string;
  page: number;
  limit: number;
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const qp = (req.validQuery ?? {}) as unknown as ListQuery;
    const filter: Record<string, unknown> = { userId: req.userId };

    if (qp.status) filter.status = { $in: qp.status.split(",") };
    if (qp.company) filter.company = { $regex: qp.company, $options: "i" };
    if (qp.tag) filter.tags = qp.tag;
    if (qp.q) filter.$text = { $search: qp.q };

    const sort = qp.sort ?? "-createdAt";
    const skip = (qp.page - 1) * qp.limit;

    const [data, total] = await Promise.all([
      ApplicationModel.find(filter).sort(sort).skip(skip).limit(qp.limit),
      ApplicationModel.countDocuments(filter),
    ]);

    res.json({
      data,
      meta: { total, page: qp.page, limit: qp.limit, pages: Math.ceil(total / qp.limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const doc = await ApplicationModel.create({ ...req.body, userId: req.userId });
    await invalidateStats(req.userId!);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
};

/**
 * Ownership misses return 404, not 403.
 *
 * A 403 confirms the id exists and belongs to someone else, which leaks the
 * existence of other users' records to anyone probing ids.
 */
async function findOwned(id: string, userId: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  return ApplicationModel.findOne({ _id: id, userId });
}

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const doc = await findOwned(String(req.params.id), req.userId!);
    if (!doc) return next(notFound("Application not found"));
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const doc = await findOwned(String(req.params.id), req.userId!);
    if (!doc) return next(notFound("Application not found"));

    // Load-then-save rather than findOneAndUpdate: it is what makes the
    // pre-save hook and schema validators fire, and it gives the hook the
    // prior status it needs to write an accurate history entry.
    doc.$locals.previousStatus = doc.status as Status;
    doc.set(req.body as Record<string, unknown>);
    await doc.save();

    await invalidateStats(req.userId!);
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const doc = await findOwned(String(req.params.id), req.userId!);
    if (!doc) return next(notFound("Application not found"));
    await doc.deleteOne();
    await invalidateStats(req.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const stats: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getStats(req.userId!));
  } catch (err) {
    next(err);
  }
};
