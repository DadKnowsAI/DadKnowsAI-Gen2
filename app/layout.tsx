import "./globals.css";

export const metadata = {
  title: "DadKnowsAI",
  description: "Beta chatbot with GPT-5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics 4 */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZLLW3P8YJZ"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ZLLW3P8YJZ', { send_page_view: true, debug_mode: true });
            `,
          }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <title>DadKnowsAI</title>
        <meta name="description" content="Beta chatbot with GPT-5" />
      </head>
      <body>{children}</body>
    </html>
  );
}
