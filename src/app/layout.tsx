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
        {/* Inject public env at runtime without extra network calls */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try{window.__PUBLIC_ENV=window.__PUBLIC_ENV||{};}catch(e){}
                try{window.__PUBLIC_ENV.GOOGLE_CLIENT_ID=${JSON.stringify((process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim())};}catch(e){}
              })();
            `,
          }}
        />
        <ModalProvider>
          <Navbar />
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
