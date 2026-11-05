import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic SOC Analyst Platform",
  description: "Security operations, evidence-backed analysis and controlled response.",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="de"><body className="font-sans antialiased">{children}</body></html>;
}
