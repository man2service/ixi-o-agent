import Link from "next/link";
import { ShowcaseDemo } from "./ShowcaseDemo";

export const metadata = {
  title: "ixi-O Agent Experience",
  description: "Interactive ixi-O Agent demo"
};

export default function ShowcasePage() {
  return (
    <main className="showcase-shell">
      <nav className="showcase-nav" aria-label="showcase navigation">
        <Link href="/showcase" className="showcase-brand">
          <span>IA</span>
          ixi-O Agent
        </Link>
        <div>
          <a href="#experience">Experience</a>
          <a href="#guided-flow">Flow</a>
          <a href="https://github.com/man2service/ixi-o-agent">GitHub</a>
        </div>
      </nav>

      <ShowcaseDemo />
    </main>
  );
}
