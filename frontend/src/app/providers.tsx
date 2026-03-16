"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, http } from "wagmi";
import { bsc } from "wagmi/chains";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  metaMaskWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Dragon Reward Distributor",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "85e4a3d844c5f661744d8d53139200ab",
  chains: [bsc],
  transports: {
    [bsc.id]: http("https://bsc-dataseed.binance.org/"),
  },
  wallets: [
    {
      groupName: "Popular",
      wallets: [binanceWallet, metaMaskWallet, walletConnectWallet, injectedWallet],
    },
  ],
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#e87c2a" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
