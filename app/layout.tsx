import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = {
  title: {
    default: "Nodedistro Labs — Ideas into electronics",
    template: "%s · Nodedistro Labs",
  },
  description:
    "An AI-assisted electronics workspace. Plan circuits, capture schematics, lay out boards, and inspect engineering checks.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
