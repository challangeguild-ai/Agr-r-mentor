import type { Metadata } from "next";
import "./globals.css";
import "./notifications.css";
import "./portal-theme.css";
import "./farmer-template.css";

export const metadata: Metadata = {
  title: "Agrár Mentor",
  description: "Személyes agrár-szaktanácsadás és ügyfélportál",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
