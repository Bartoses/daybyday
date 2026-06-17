import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { loadConfig, type AppConfig } from "./config.js";
import { makeTwilioPreHandler } from "./security/twilioPreHandler.js";
import { makeServiceClient } from "./supabase.js";
import { accountRoutes } from "./routes/account.js";
import { childrenRoutes } from "./routes/children.js";
import { feedRoutes } from "./routes/feed.js";
import { questionRoutes } from "./routes/questions.js";
import { dayRoutes } from "./routes/day.js";
import { milestoneRoutes } from "./routes/milestones.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { progressRoutes } from "./routes/progress.js";
import { pushRoutes } from "./routes/push.js";
import { notificationRoutes } from "./routes/notifications.js";
import { cronRoutes } from "./routes/cron.js";
import { adminRoutes } from "./routes/admin.js";

/**
 * Builds the Fastify app. Health + guarded SMS webhook + the EPIC 4 feature
 * routes (account, children, feed). SMS routing lands in EPIC 5.
 */
export function buildApp(config: AppConfig = loadConfig()): FastifyInstance {
  const app = Fastify({ logger: { level: config.nodeEnv === "test" ? "silent" : "info" } });

  app.register(cors, { origin: true });

  // Allow body-less POSTs (e.g. /onboarding/complete) even when the client sends
  // content-type: application/json — treat an empty body as undefined, not a 400.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (body === "" || body == null) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      (err as Error & { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });

  app.decorate("config", config);
  app.decorate("db", makeServiceClient(config));

  app.get("/health", async () => ({
    status: "ok",
    service: "daybyday-api",
    env: config.nodeEnv,
    twilio_validation: config.twilio.validate,
  }));

  // SMS webhook — guarded by signature validation (EPIC 5 fills in routing).
  app.post(
    "/v1/webhooks/sms",
    { preHandler: makeTwilioPreHandler(config) },
    async (_req, reply) => {
      // Placeholder: real STOP/HELP/START + onboarding routing arrives in EPIC 5.
      return reply.type("text/xml").send("<Response></Response>");
    },
  );

  // EPIC 4 feature routes.
  app.register(accountRoutes);
  app.register(childrenRoutes);
  app.register(feedRoutes);
  app.register(questionRoutes);
  app.register(dayRoutes);
  app.register(milestoneRoutes);
  app.register(analyticsRoutes);
  app.register(progressRoutes);
  app.register(pushRoutes);
  app.register(notificationRoutes);
  app.register(cronRoutes);
  app.register(adminRoutes);

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}
