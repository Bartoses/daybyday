import { z } from "zod";
import { RequestType } from "./enums.js";
import { Child, ChildWithAge, FeedCard, Milestone, Parent, Subscription } from "./models.js";

/** Request/response contracts for the Node API (docs/08-API-SPEC.md). */

// POST /v1/account/bootstrap
export const BootstrapRequest = z.object({
  name: z.string().min(1).max(80),
  timezone: z.string().default("America/Denver"),
  focus_area: z.enum(["daily_guidance", "sleep_support", "big_feelings"]).optional(),
  sms_opt_in: z.boolean().default(false),
  consent_text: z.string().optional(),
  consent_source: z.string().optional(),
});
export type BootstrapRequest = z.infer<typeof BootstrapRequest>;

export const BootstrapResponse = z.object({
  parent_id: z.string().uuid(),
  onboarding_step: Parent.shape.onboarding_step,
});
export type BootstrapResponse = z.infer<typeof BootstrapResponse>;

// GET /v1/me
export const MeResponse = z.object({
  parent: Parent,
  children: z.array(ChildWithAge),
  subscription: Subscription.nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;

// POST /v1/children
export const CreateChildRequest = z
  .object({
    name: z.string().min(1).max(80),
    birthdate: z.string().date().optional(),
    due_date: z.string().date().optional(),
    gender: z.string().optional(),
  })
  .refine((v) => v.birthdate || v.due_date, {
    message: "Either birthdate or due_date is required",
  });
export type CreateChildRequest = z.infer<typeof CreateChildRequest>;

export const ChildResponse = ChildWithAge;
export type ChildResponse = z.infer<typeof ChildResponse>;

// GET /v1/feed/today
export const FeedTodayQuery = z.object({ child_id: z.string().uuid() });
export type FeedTodayQuery = z.infer<typeof FeedTodayQuery>;

// POST /v1/feed/quick-action
export const QuickActionRequest = z.object({
  child_id: z.string().uuid(),
  request_type: RequestType,
});
export type QuickActionRequest = z.infer<typeof QuickActionRequest>;

export const FeedResponse = FeedCard;
export type FeedResponse = z.infer<typeof FeedResponse>;

// POST /v1/feed/:tip_id/feedback
export const FeedbackRequest = z.object({
  child_id: z.string().uuid(),
  helpful: z.boolean(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

// POST /v1/children/:id/milestones
export const CreateMilestoneRequest = z.object({
  milestone_key: z.string(),
  achieved_on: z.string().date(),
  note: z.string().max(500).optional(),
});
export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequest>;

export const MilestoneResponse = Milestone;
export type MilestoneResponse = z.infer<typeof MilestoneResponse>;

// Standard error envelope
export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "PAYMENT_REQUIRED",
      "NOT_FOUND",
      "VALIDATION",
      "RATE_LIMITED",
      "SAFETY_ESCALATED",
      "INTERNAL",
    ]),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const CreateChildResponse = Child;
