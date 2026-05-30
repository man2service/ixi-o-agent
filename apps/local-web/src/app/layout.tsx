import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Phone-Claw",
  description: "Local voice bridge for agent-ready work context"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

