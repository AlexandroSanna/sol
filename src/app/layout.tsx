import React from "react";
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "SPL Deploy dApp (Mainnet)",
  description: "DApp su Solana mainnet.",
};

// NIENTE "use client" qui, così puoi usare metadata
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

