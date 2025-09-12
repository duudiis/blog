import type { Metadata } from "next";
import "./globals.css";
import { Montserrat } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { ModalProvider } from "@/components/Modal";
import { SITE_NAME } from "@/lib/site";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s • ${SITE_NAME}`,
  },
  description: "Personal blog",
  icons: {
    icon: [
      { url: "/favicon-black.ico", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-white.ico", media: "(prefers-color-scheme: dark)" },
    ],
  },
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={montserrat.variable}>
        <ModalProvider>
          <Navbar />
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
