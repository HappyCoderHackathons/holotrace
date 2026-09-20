import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Same typefaces as the Tauri app (see tailwind.config.js fontFamily).
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Holotrace — Hand-drawn circuits, made interactive',
  description:
    'Turn a hand-drawn circuit into an interactive model you can inspect, edit, and understand on Windows, macOS, Linux, or Android.',
  metadataBase: new URL('https://holotrace.yoyojesus.chatgpt.site'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
