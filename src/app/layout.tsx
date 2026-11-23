import type { Metadata, Viewport } from "next";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/jost/600.css";
import "@fontsource/jost/700.css";
import "@fontsource/anuphan/400.css";
import "@fontsource/anuphan/500.css";
import "@fontsource/anuphan/600.css";
import "@fontsource/anuphan/700.css";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "BLUE CHECK-IN · สีฟ้าเช็คชื่อกันน",
  description:
    "ระบบเช็คชื่อนักเรียนคณะสีฟ้า โรงเรียนวัดโสธรวรารามวรวิหาร — รองรับมือถือ แท็บเล็ต และคอมพิวเตอร์",
  authors: [{ name: "นายธารินทร ไผ่ล้อมทำเล" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F6FC" },
    { media: "(prefers-color-scheme: dark)", color: "#101318" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="canvas-backdrop antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
