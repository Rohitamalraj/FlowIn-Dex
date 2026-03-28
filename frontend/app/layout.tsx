import type React from "react"
import type { Metadata } from "next"
import { IBM_Plex_Mono, Montserrat } from "next/font/google"
import "./globals.css"
import ClientLayout from "./client-layout"

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
})

export const metadata: Metadata = {
  title: "ShieldVault - Confidential Portfolio Duels",
  description: "Encrypted competitive portfolio platform on Zama fhEVM. Your strategies stay private.",
  generator: "ShieldVault",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-mono ${ibmPlexMono.variable} ${montserrat.variable}`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
