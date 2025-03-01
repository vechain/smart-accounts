import { defineConfig } from "../defineConfig";
export function createMainnetConfig() {
  return defineConfig({
    VITE_APP_ENV: "mainnet",
    B3TR_TOKEN_ADDRESS: "0x5ef79995FE8a89e0812330E4378eB2660ceDe699",
  });
}
