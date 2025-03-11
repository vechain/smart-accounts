import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { VeChainKitProvider } from "@vechain/vechain-kit";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.ts";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { theme } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme}>
        <VeChainKitProvider
          feeDelegation={{
            delegatorUrl: import.meta.env.VITE_DELEGATOR_URL!,
            delegateAllTransactions: false,
          }}
          dappKit={{
            allowedWallets: ["veworld", "sync2"],
          }}
          loginModalUI={{
            description:
              "Choose between social login through VeChain or by connecting your wallet.",
          }}
          darkMode={false}
          language={"en"}
          network={{
            type: "main",
          }}
          loginMethods={[
            { method: "vechain", gridColumn: 4 },
            { method: "dappkit", gridColumn: 4 },
            { method: "ecosystem", gridColumn: 4 },
          ]}
        >
          <App />
        </VeChainKitProvider>
      </ChakraProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
