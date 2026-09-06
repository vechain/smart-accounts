import { defineConfig } from "../defineConfig";

export function createLocalConfig() {
  return defineConfig({
    VITE_APP_ENV: "local",
    B3TR_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000000",
  });
}
