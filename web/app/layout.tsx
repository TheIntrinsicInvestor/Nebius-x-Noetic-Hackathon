import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "NorthStar",
  description: "Covenant early warning: see the covenant breach before your bank does.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${garamond.variable} antialiased`}>{children}</body>
    </html>
  );
}
