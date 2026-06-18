import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "NVP — Decentralized AI, powered by phones",
  description:
    "A ChatGPT-style chatbot that runs on a network of iPhones. Phone owners earn real money running AI on demand.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
