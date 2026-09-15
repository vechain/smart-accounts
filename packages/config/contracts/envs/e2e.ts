import { createLocalConfig } from "./local";
export function createE2EConfig() {
  console.log("Creating E2E config...");
  const localConfig = createLocalConfig();
  return localConfig;
}
