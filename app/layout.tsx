import './globals.css'

export const metadata = {
  title: 'DadKnowsAI',
  description: 'Beta chatbot with GPT-5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
