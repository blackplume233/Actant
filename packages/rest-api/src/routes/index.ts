import type { Router } from "../router";
import { registerAgentRoutes } from "./agents";
import { registerTemplateRoutes } from "./templates";
import { registerEventRoutes } from "./events";
import { registerCanvasRoutes } from "./canvas";
import { registerStatusRoutes } from "./status";
import { registerDomainRoutes } from "./domain";
import { registerSessionRoutes } from "./sessions";
import { registerWebhookRoutes } from "./webhooks";

export function registerAllRoutes(router: Router): void {
  registerStatusRoutes(router);
  registerAgentRoutes(router);
  registerTemplateRoutes(router);
  registerEventRoutes(router);
  registerCanvasRoutes(router);
  registerDomainRoutes(router);
  registerSessionRoutes(router);
  registerWebhookRoutes(router);
}
