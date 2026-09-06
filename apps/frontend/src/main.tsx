import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { VeChainKitProvider } from "@vechain/vechain-kit";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.ts";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Provider } from "./components/ui/provider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider>
        <VeChainKitProvider
          dappKit={{
            allowedWallets: ["veworld", "sync2"],
          }}
          theme={{
            modal: {
              backgroundColor: "rgba(21, 21, 21, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.20)",
              backdropFilter: "blur(20px)",
              rounded: "32px",
            },
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.24)",
              blur: "blur(15px)",
            },
            buttons: {
              primaryButton: {
                bg: "white",
                color: "blackAlpha.900",
                rounded: "full",
              },
              secondaryButton: {
                bg: "rgb(255 255 255 / 4%)",
                color: "white",
              },
            },
          }}
          darkMode={true}
          language={"en"}
          network={{
            type: "main",
          }}
          loginMethods={[
            { method: "veworld", gridColumn: 4 },
            { method: "google", gridColumn: 4 },
            { method: "apple", gridColumn: 4 },
            { method: "more", gridColumn: 4 },
          ]}
        >
          <App />
        </VeChainKitProvider>
      </Provider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
);
