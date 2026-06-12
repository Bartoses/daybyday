import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { loadConfig, type AppConfig } from "./config.js";
import { makeTwilioPreHandler } from "./security/twilioPreHandler.js";
import { makeServiceClient } from "./supabase.js";
import { accountRoutes } from "./routes/account.js";
import { childrenRoutes } from "./routes/children.js";
import { feedRoutes } from "./routes/feed.js";

/**
 * Builds the Fastify app. Health + guarded SMS webhook + the EPIC 4 feature
 * routes (account, children, feed). SMS routing lands in EPIC 5.
 */
export function buildApp(config: AppConfig = loadConfig()): FastifyInstance {
  const app = Fastify({ logger: { level: config.nodeEnv === "test" ? "silent" : "info" } });

  app.register(cors, { origin: true });

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

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}
