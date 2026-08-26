import type { Metadata } from "next";
import "./globals.css";
import "./notifications.css";
import "./portal-final.css";
import "./public-site.css";
import "./mobile-hardening.css";

export const metadata: Metadata = {
  title: "Agrár Mentor | Személyes agrár-szaktanácsadás",
  description: "Személyes agrár-szaktanácsadás helyszíni szemlékkel, szakmai nyomon követéssel és digitális ügyfélfelülettel.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hu"><body>{children}</body></html>;
}
