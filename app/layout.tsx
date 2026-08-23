import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./gildedglow.css";

export const metadata: Metadata = {
  title: "GildedGlow",
  description: "GildedGlow inventory & POS management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--gray-200)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-md)",
            },
            success: {
              iconTheme: { primary: "var(--success)", secondary: "#fff" },
              style: {
                background: "var(--success-bg)",
                color: "var(--success-fg)",
                border: "1px solid var(--success-bg)",
              },
            },
            error: {
              iconTheme: { primary: "var(--danger)", secondary: "#fff" },
              style: {
                background: "var(--danger-bg)",
                color: "var(--danger-fg)",
                border: "1px solid var(--danger-bg)",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
