import { z } from "zod";
import {
  Category,
  Channel,
  MessageType,
  OnboardingStep,
  ParentStatus,
  Plan,
  StageKey,
} from "./enums.js";

/** Domain models mirroring the Postgres schema in docs/07-DATABASE-DESIGN.md. */

export const Parent = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  timezone: z.string(),
  onboarding_step: OnboardingStep,
  focus_area: z.string().nullable(),
  status: ParentStatus,
  sms_opt_in: z.boolean(),
  preferred_send_hour: z.number().int().min(0).max(23).nullable(),
  referral_code: z.string().nullable(),
  preferences: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Parent = z.infer<typeof Parent>;

export const Child = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid(),
  name: z.string(),
  birthdate: z.string().nullable(),
  due_date: z.string().nullable(),
  gender: z.string().nullable(),
  photo_url: z.string().url().nullable(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Child = z.infer<typeof Child>;

/** A child enriched with derived age/stage (computed server-side, never stored). */
export const ChildWithAge = Child.extend({
  age_days: z.number().int().nullable(),
  stage: StageKey.nullable(),
});
export type ChildWithAge = z.infer<typeof ChildWithAge>;

export const ContentItem = z.object({
  id: z.string().uuid(),
  tip_id: z.string(),
  category: Category,
  subcategory: z.string().nullable(),
  age_min_days: z.number().int(),
  age_max_days: z.number().int(),
  stage: z.string().nullable(),
  insight: z.string(),
  action_tip: z.string(),
  reassurance: z.string(),
  when_to_consult_doctor: z.string().nullable(),
  signs_of_healthy_development: z.string().nullable(),
  difficulty_level: z.string(),
  cooldown_days: z.number().int(),
  priority_weight: z.number(),
  rotation_group: z.string().nullable(),
  active: z.boolean(),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const FeedCard = z.object({
  child_id: z.string().uuid(),
  date: z.string(),
  tip_id: z.string(),
  category: Category,
  stage: StageKey.nullable(),
  insight: z.string(),
  action_tip: z.string(),
  reassurance: z.string(),
  when_to_consult_doctor: z.string().nullable(),
  sources: z.array(z.string()),
  saved: z.boolean(),
});
export type FeedCard = z.infer<typeof FeedCard>;

export const Milestone = z.object({
  id: z.string().uuid(),
  child_id: z.string().uuid(),
  milestone_key: z.string(),
  label: z.string().nullable(),
  achieved_on: z.string().nullable(),
  note: z.string().nullable(),
  photo_url: z.string().url().nullable(),
});
export type Milestone = z.infer<typeof Milestone>;

export const Subscription = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid(),
  plan: Plan,
  period: z.enum(["monthly", "annual"]).nullable(),
  status: z.string(),
  current_period_end: z.string().nullable(),
});
export type Subscription = z.infer<typeof Subscription>;

export const Message = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid(),
  child_id: z.string().uuid().nullable(),
  tip_id: z.string().nullable(),
  message_type: MessageType,
  channel: Channel,
  send_date: z.string(),
  send_status: z.string(),
});
export type Message = z.infer<typeof Message>;
