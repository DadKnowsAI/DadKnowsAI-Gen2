import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "DadKnowsAI",
  description: "Beta chatbot with GPT-5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = "G-ZLLW3P8YJZ";
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Beta chatbot with GPT-5" />
        <title>DadKnowsAI</title>

        {/* GA4 (preferred Next.js way) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { send_page_view: true, debug_mode: true });
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
