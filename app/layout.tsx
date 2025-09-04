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
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZLLW3P8YJZ"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ZLLW3P8YJZ', { send_page_view: true });
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
