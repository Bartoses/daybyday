import { z } from "zod";

/**
 * Canonical enums ported from the legacy Apps Script `APP_CONFIG` (Config.js).
 * These are the single source of truth shared by the API and the mobile app.
 */

// Parent onboarding FSM (Config.js: parentStatuses / onboardingSteps)
export const OnboardingStep = z.enum([
  "NEW",
  "WAITING_ONBOARDING_CHOICE",
  "WAITING_NAME",
  "WAITING_CHILD_NAME",
  "WAITING_CHILD_BIRTHDATE",
  "ASK_ADD_CHILD",
  "ONBOARDED",
]);
export type OnboardingStep = z.infer<typeof OnboardingStep>;

export const ParentStatus = z.enum(["active", "unsubscribed"]);
export type ParentStatus = z.infer<typeof ParentStatus>;

// Canonical content categories (Config.js: canonicalizeTopic_ output set).
export const Category = z.enum([
  "sleep",
  "feeding",
  "development",
  "learning_play",
  "emotional",
  "behavior",
  "safety",
]);
export type Category = z.infer<typeof Category>;

// Developmental stages with day ranges (Config.js: APP_CONFIG.stages).
export const StageKey = z.enum([
  "newborn",
  "early_baby",
  "growing_baby",
  "exploring_baby",
  "new_toddler",
  "curious_toddler",
  "preschooler",
  "early_school_age",
]);
export type StageKey = z.infer<typeof StageKey>;

export interface StageDef {
  key: StageKey;
  label: string;
  minAgeDays: number;
  maxAgeDays: number;
}

export const STAGES: readonly StageDef[] = [
  { key: "newborn", label: "Newborn", minAgeDays: 0, maxAgeDays: 56 },
  { key: "early_baby", label: "Early Baby", minAgeDays: 57, maxAgeDays: 120 },
  { key: "growing_baby", label: "Growing Baby", minAgeDays: 121, maxAgeDays: 210 },
  { key: "exploring_baby", label: "Exploring Baby", minAgeDays: 211, maxAgeDays: 365 },
  { key: "new_toddler", label: "New Toddler", minAgeDays: 366, maxAgeDays: 540 },
  { key: "curious_toddler", label: "Curious Toddler", minAgeDays: 541, maxAgeDays: 1095 },
  { key: "preschooler", label: "Preschooler", minAgeDays: 1096, maxAgeDays: 1825 },
  { key: "early_school_age", label: "Early School Age", minAgeDays: 1826, maxAgeDays: 3650 },
] as const;

export const MessageType = z.enum([
  "daily",
  "followup",
  "checkin",
  "milestone",
  "onboarding",
  "welcome",
  "share",
  "system",
]);
export type MessageType = z.infer<typeof MessageType>;

export const RequestType = z.enum(["daily", "another_tip", "sleep", "play", "feeding", "behavior"]);
export type RequestType = z.infer<typeof RequestType>;

export const Channel = z.enum(["push", "sms", "email", "in_app"]);
export type Channel = z.infer<typeof Channel>;

export const Plan = z.enum(["free", "premium", "family"]);
export type Plan = z.infer<typeof Plan>;

export const CaregiverRole = z.enum(["owner", "caregiver", "viewer"]);
export type CaregiverRole = z.infer<typeof CaregiverRole>;
