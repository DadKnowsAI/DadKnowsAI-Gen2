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
          `}
        </Script>

        {/* Attribution capture + helpers */}
        <Script id="dk-attribution" strategy="afterInteractive">
          {`
            (function(){
              // ---- 1) Capture UTM & fbclid once (first-touch) ----
              function getQuery() {
                try {
                  var q = new URLSearchParams(window.location.search);
                  return {
                    utm_source: q.get('utm_source') || '',
                    utm_medium: q.get('utm_medium') || '',
                    utm_campaign: q.get('utm_campaign') || '',
                    utm_content: q.get('utm_content') || '',
                    utm_term: q.get('utm_term') || '',
                    fbclid: q.get('fbclid') || ''
                  };
                } catch { return {}; }
              }
              var KEY_ATTR = 'dk_attrib_v1';
              var KEY_CHAT = 'dk_chat_engaged';
              var KEY_CHAT_COUNT = 'dk_chat_messages';

              var existing = null;
              try { existing = JSON.parse(localStorage.getItem(KEY_ATTR) || 'null'); } catch {}
              if (!existing) {
                var qp = getQuery();
                // Compose _fbc (Facebook click token) best-effort from fbclid
                var _fbc = '';
                if (qp.fbclid) {
                  _fbc = 'fb.1.' + Date.now() + '.' + qp.fbclid;
                }
                var payload = {
                  utm_source: qp.utm_source,
                  utm_medium: qp.utm_medium,
                  utm_campaign: qp.utm_campaign,
                  utm_content: qp.utm_content,
                  utm_term: qp.utm_term,
                  fbclid: qp.fbclid,
                  _fbc: _fbc
                };
                try { localStorage.setItem(KEY_ATTR, JSON.stringify(payload)); } catch {}
              }

              function readAttrib(){
                try { return JSON.parse(localStorage.getItem(KEY_ATTR) || '{}'); }
                catch { return {}; }
              }

              // ---- 2) Expose safe tracking helpers ----
              window.dkTrack = {
                chatEngaged: function(messagesCount){
                  try {
                    var m = Number(messagesCount || 0);
                    localStorage.setItem(KEY_CHAT, '1');
                    localStorage.setItem(KEY_CHAT_COUNT, String(m));
                    var attrib = readAttrib();
                    if (typeof fbq === 'function') {
                      fbq('trackCustom', 'ChatEngaged', Object.assign({ messages: m }, attrib));
                    }
                  } catch(e){}
                },
                lead: function(extra){
                  try {
                    var attrib = readAttrib();
                    var engaged = localStorage.getItem(KEY_CHAT) === '1';
                    var m = Number(localStorage.getItem(KEY_CHAT_COUNT) || 0);
                    var payload = Object.assign(
                      {
                        chat_engaged: engaged,
                        messages: m
                      },
                      attrib,
                      (extra && typeof extra === 'object') ? extra : {}
                    );

                    // Standard Lead with rich params
                    if (typeof fbq === 'function') {
                      fbq('track', 'Lead', payload);
                    }
                  } catch(e){}
                }
              };

              // ---- 3) Optional: support custom DOM events (no code changes elsewhere) ----
              window.addEventListener('dk:chat_engaged', function(e){
                var c = (e && e.detail && e.detail.messages) ? e.detail.messages : 0;
                try { window.dkTrack.chatEngaged(c); } catch {}
              });
              window.addEventListener('dk:lead', function(e){
                try { window.dkTrack.lead((e && e.detail) || undefined); } catch {}
              });
            })();
          `}
        </Script>
      </head>

      <body>
        {/* Meta Pixel <noscript> */}
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
