import { CursorCloudAgentRunner, CURSOR_MODEL_AUTO } from "./cursor.js";
import { OzCloudAgentRunner } from "./oz.js";
import type { CloudAgentRunner, CloudProvider, CloudRunnerConfig } from "./types.js";
import { cfgRemoteProvider } from "../types.js";
import type { RalphConfig } from "../types.js";

export { CURSOR_MODEL_AUTO };

export function cloudRunnerConfigFromRalph(cfg: RalphConfig): CloudRunnerConfig {
  const provider = cfgRemoteProvider(cfg);
  if (!provider) {
    throw new Error(`Worker ${cfg.worker} is not a remote worker`);
  }
  return {
    provider,
    stateDir: cfg.stateDir,
    pollIntervalSec: cfg.cloudPollInterval,
    repoUrl: cfg.repoUrl,
    branch: cfg.branch,
    cursorApiKey: cfg.cursorApiKey,
    cloudEnv: cfg.cloudEnv,
    cloudModel: cfg.cloudModel,
    autoCreatePr: cfg.cloudCreatePrOnFinal,
    warpApiKey: cfg.warpApiKey,
    ozEnvironmentId: cfg.ozEnvironmentId,
    ozModelId: cfg.ozModelId,
    ozConfigName: cfg.ozConfigName,
  };
}

export function createCloudAgentRunner(config: CloudRunnerConfig): CloudAgentRunner {
  switch (config.provider) {
    case "cursor":
      return new CursorCloudAgentRunner(config);
    case "oz":
      return new OzCloudAgentRunner(config);
    default: {
      const p = config.provider as CloudProvider;
      throw new Error(`Unknown cloud provider: ${p}`);
    }
  }
}

export function createCloudAgentRunnerFromRalph(cfg: RalphConfig): CloudAgentRunner {
  return createCloudAgentRunner(cloudRunnerConfigFromRalph(cfg));
}
