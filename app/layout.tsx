import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learn with Mindmaps",
  description: "Turn a codebase, document, or topic into a mind map you can drill into.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
