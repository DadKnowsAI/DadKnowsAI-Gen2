// app/layout.tsx
import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "DadKnowsAI",
  description: "Beta chatbot with GPT-5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = "G-ZLLW3P8YJZ";
  const FB_PIXEL_ID = "739734105625457";

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Beta chatbot with GPT-5" />
        <title>DadKnowsAI</title>

        {/* GA4 */}
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

        {/* Meta Pixel base */}
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)n=f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');

            fbq('init', '${FB_PIXEL_ID}');
            fbq('track', 'PageView');

            // Expose a helper for conversions (use this after successful signup)
            window.fbLead = function(payload) {
              try {
                if (typeof fbq === 'function') {
                  if (payload && typeof payload === 'object') {
                    fbq('track', 'Lead', payload);
                  } else {
                    fbq('track', 'Lead');
                  }
                }
              } catch (e) {}
            };

            // Also support a custom event trigger if you prefer:
            // window.dispatchEvent(new Event('dk:lead'))
            window.addEventListener('dk:lead', function() {
              try { if (typeof fbq === 'function') fbq('track', 'Lead'); } catch (e) {}
            });
          `}
        </Script>
      </head>

      <body>
        {/* Meta Pixel <noscript> (recommended just inside <body>) */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>

        {children}
      </body>
    </html>
  );
}
