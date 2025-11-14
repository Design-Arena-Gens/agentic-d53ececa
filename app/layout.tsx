import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Voice Agents Studio",
  description: "Build, customize, and converse with AI voice agents in your browser."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
