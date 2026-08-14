import type { RequestHandler } from "express";
import { UserModel, hashPassword, type UserDoc } from "../models/User";
import { issueTokenPair, rotateRefreshToken, revokeRefreshToken } from "../services/tokens";
import { conflict, unauthorized } from "../utils/errors";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { email, name, password } = req.body as { email: string; name: string; password: string };
    const existing = await UserModel.findOne({ email }).collation({ locale: "en", strength: 2 });
    if (existing) return next(conflict("An account with that email already exists"));

    const user = await UserModel.create({ email, name, passwordHash: await hashPassword(password) });
    const tokens = await issueTokenPair(String(user._id));
    res.status(201).json({ user: { id: user._id, email: user.email, name: user.name }, ...tokens });
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = (await UserModel.findOne({ email })
      .select("+passwordHash")
      .collation({ locale: "en", strength: 2 })) as UserDoc | null;

    // Same message and same work either way — a distinct "no such user"
    // response turns the login route into an account enumeration oracle.
    if (!user || !(await user.verifyPassword(password))) {
      return next(unauthorized("Invalid credentials"));
    }

    const tokens = await issueTokenPair(String(user._id));
    res.json({ user: { id: user._id, email: user.email, name: user.name }, ...tokens });
  } catch (err) {
    next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    res.json(await rotateRefreshToken((req.body as { refreshToken: string }).refreshToken));
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    await revokeRefreshToken((req.body as { refreshToken: string }).refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) return next(unauthorized());
    res.json({ id: user._id, email: user.email, name: user.name });
  } catch (err) {
    next(err);
  }
};
