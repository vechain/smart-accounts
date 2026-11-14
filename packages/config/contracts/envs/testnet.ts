import { defineConfig } from "../defineConfig";
export function createTestnetConfig() {
  return defineConfig({
    VITE_APP_ENV: "testnet",
    B3TR_TOKEN_ADDRESS: "0xbf64cf86894Ee0877C4e7d03936e35Ee8D8b864F",
  });
}
