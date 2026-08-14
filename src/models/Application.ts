import { Schema, model, type InferSchemaType } from "mongoose";

export const STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type Status = (typeof STATUSES)[number];

const historySchema = new Schema(
  {
    from: { type: String, enum: STATUSES },
    to: { type: String, enum: STATUSES, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    status: { type: String, enum: STATUSES, default: "wishlist", required: true },
    location: { type: String, trim: true },
    url: { type: String, trim: true },
    notes: { type: String },
    tags: { type: [String], default: [] },
    appliedAt: { type: Date },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

// Compound index matching the dominant query shape: a user's own board,
// filtered by status, newest first. userId alone would still scan every
// status the user has.
applicationSchema.index({ userId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ userId: 1, tags: 1 });
applicationSchema.index({ company: "text", role: "text", notes: "text" });

// Record every status transition. Done as a pre-save hook rather than in the
// controller so a transition can never be written without its history entry.
//
// The previous status comes from $locals, set by the controller before save.
// Mongoose exposes no public API for a modified path's prior value, and the
// controller already loaded the document — this is the reason the update path
// uses load-then-save rather than findOneAndUpdate.
applicationSchema.pre("save", function (next) {
  const now = new Date();
  if (this.isNew) {
    this.set("history", [{ to: this.status, at: now }]);
  } else if (this.isModified("status")) {
    const from = this.$locals.previousStatus as Status | undefined;
    this.set("history", [...this.get("history"), { from, to: this.status, at: now }]);
  }
  next();
});

export type Application = InferSchemaType<typeof applicationSchema>;
export const ApplicationModel = model<Application>("Application", applicationSchema);
