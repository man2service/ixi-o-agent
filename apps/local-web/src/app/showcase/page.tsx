import Link from "next/link";
import { ShowcaseDemo } from "./ShowcaseDemo";

const architectureModes = [
  {
    title: "기업용",
    source: "Channel Talk",
    processing: "Mac mini M4 local server",
    ai: "Whisper STT + EXAONE summary",
    privacy: "PII masking, decision-only handoff",
    output: "Kiya action proposal / MISO custom tool payload"
  },
  {
    title: "개인용",
    source: "Local recorder or voice file",
    processing: "Private local processing",
    ai: "Whisper STT + EXAONE full-context summary",
    privacy: "No masking by default",
    output: "Full transcript + summary to personal agent"
  }
];

const friendliNotes = [
  {
    title: "기본값은 로컬",
    detail:
      "대회 데모와 실제 개인 사용의 기본 경로는 Mac mini M4에서 Whisper와 EXAONE을 직접 돌리는 구조입니다."
  },
  {
    title: "FriendliAI는 선택형 가속 경로",
    detail:
      "로컬 추론이 느리거나 안정적인 hosted GPU가 필요할 때, OpenAI-compatible endpoint로 EXAONE/Whisper 경로를 붙일 수 있습니다."
  },
  {
    title: "기업용은 masked payload만",
    detail:
      "FriendliAI를 쓰더라도 기업용 원문 통화와 개인정보는 보내지 않고, 마스킹된 요약 또는 명시 승인된 샘플만 보냅니다."
  }
];

const designDecisions = [
  {
    number: "01",
    title: "Button hierarchy",
    detail: "주요 진행은 fill 버튼, 보조 탐색은 weak 버튼으로 분리합니다.",
    badge: "Primary",
    badgeTone: "fill"
  },
  {
    number: "02",
    title: "Status badge",
    detail: "로컬 처리, 검수, 전달 가능 여부를 짧은 상태 값으로 표시합니다.",
    badge: "Reviewed",
    badgeTone: "weak"
  },
  {
    number: "03",
    title: "ListRow handoff",
    detail: "전사문 원본, 요약, 마스킹 payload를 좌측 맥락과 우측 상태로 읽게 합니다.",
    badge: "Ready",
    badgeTone: "success"
  }
];

const submissionMessages = [
  "LG U+ Track: Voice AI 입력과 EXAONE 활용이 체험 플로우의 핵심 단계에 드러납니다.",
  "Security: 기업용은 raw audio/transcript를 로컬에 두고, 개인정보 마스킹 뒤 결정 사항만 전달합니다.",
  "Personal Mode: 사용자가 원하면 마스킹 없이 전체 맥락을 개인 에이전트에게 넘깁니다.",
  "MISO Track: 직접 push가 아니라 custom tool/OpenAPI로 안전한 inbound voice context를 제안합니다."
];

export const metadata = {
  title: "ixi-O Agent Experience",
  description: "Interactive ixi-O Agent personal and enterprise flow demo"
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
          <a href="#design">Design</a>
          <a href="#architecture">Architecture</a>
          <a href="#ops">Ops</a>
          <a href="#submission">Submission</a>
          <a href="https://github.com/man2service/ixi-o-agent">GitHub</a>
        </div>
      </nav>

      <section className="showcase-hero">
        <div className="showcase-hero-copy">
          <h1>일상의 모든 Voice를, 에이전트와 함께</h1>
          <p>
            ixi-O Agent는 기업 고객 통화와 개인 회의 음성을 같은 로컬 브릿지로 받아,
            Whisper 전사와 EXAONE 요약을 거쳐 에이전트가 바로 읽을 수 있는 context로 바꿉니다.
          </p>
          <div className="showcase-hero-badges" aria-label="product principles">
            <span className="showcase-tds-badge fill">Local first</span>
            <span className="showcase-tds-badge weak">Review gate</span>
            <span className="showcase-tds-badge weak">Agent-ready</span>
          </div>
          <div className="showcase-actions">
            <a className="showcase-primary showcase-tds-button fill" href="#experience">
              체험 플로우 보기
            </a>
            <a className="showcase-secondary showcase-tds-button weak" href="https://github.com/man2service/ixi-o-agent">
              GitHub 보기
            </a>
          </div>
        </div>

        <div className="showcase-product" aria-label="ixi-O Agent experience preview">
          <div className="showcase-product-header">
            <span>Experience mode</span>
            <strong>enterprise / personal</strong>
          </div>
          <figure className="showcase-product-visual">
            <img
              src="/assets/ixi-o-agent-voice-bridge.png"
              alt="ixi-O Agent voice bridge concept dashboard"
            />
          </figure>
          <div className="showcase-product-grid">
            <article>
              <span>Enterprise</span>
              <p>채널톡 데이터는 로컬 처리 후 마스킹</p>
            </article>
            <article>
              <span>Personal</span>
              <p>개인 음성은 전체 맥락을 에이전트에게</p>
            </article>
            <article>
              <span>Local AI</span>
              <p>Whisper STT와 EXAONE 요약을 Mac mini에서</p>
            </article>
            <article>
              <span>Optional GPU</span>
              <p>FriendliAI는 필요할 때만 가속 경로로</p>
            </article>
          </div>
        </div>
      </section>

      <section className="showcase-design-system" id="design" aria-label="TDS-inspired design system">
        <div className="showcase-section-head">
          <div>
            <span className="showcase-label">TDS-inspired system</span>
            <h2>명확한 상태, 조용한 보조 액션, 리스트 중심의 정보 전달</h2>
            <p>
              TDS UI Kit 자산은 복제하지 않고, 공개 문서의 컴포넌트 원칙을 ixi-O Agent의
              자체 토큰과 컴포넌트 규칙으로 옮겼습니다.
            </p>
          </div>
        </div>
        <div className="showcase-tds-list" aria-label="design decisions">
          {designDecisions.map((decision) => (
            <article className="showcase-tds-row" key={decision.number}>
              <span className="showcase-tds-row-icon">{decision.number}</span>
              <div>
                <strong>{decision.title}</strong>
                <p>{decision.detail}</p>
              </div>
              <span className={`showcase-tds-badge ${decision.badgeTone}`}>{decision.badge}</span>
            </article>
          ))}
        </div>
      </section>

      <ShowcaseDemo />

      <section className="showcase-architecture" id="architecture">
        <div className="showcase-section-head">
          <div>
            <h2>두 가지 사용 경로</h2>
            <p>입력과 보안 정책은 다르지만, 저장 계약과 에이전트 handoff는 같은 구조를 씁니다.</p>
          </div>
        </div>
        <div className="showcase-mode-grid">
          {architectureModes.map((mode) => (
            <article className="showcase-mode-card" key={mode.title}>
              <h3>{mode.title}</h3>
              <dl>
                <div>
                  <dt>Input</dt>
                  <dd>{mode.source}</dd>
                </div>
                <div>
                  <dt>Processing</dt>
                  <dd>{mode.processing}</dd>
                </div>
                <div>
                  <dt>AI</dt>
                  <dd>{mode.ai}</dd>
                </div>
                <div>
                  <dt>Privacy</dt>
                  <dd>{mode.privacy}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{mode.output}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="showcase-session" id="ops">
        <div className="showcase-section-head">
          <div>
            <h2>FriendliAI 검토</h2>
            <p>로컬 우선 구조는 유지하고, hosted inference가 필요해지는 순간에만 API 키를 받습니다.</p>
          </div>
          <a className="showcase-text-link" href="https://friendli.ai/docs/guides/openai-compatibility">
            Friendli docs
          </a>
        </div>
        <div className="showcase-option-grid">
          {friendliNotes.map((note) => (
            <article className="showcase-option-card" key={note.title}>
              <h3>{note.title}</h3>
              <p>{note.detail}</p>
            </article>
          ))}
        </div>
        <div className="showcase-api-note">
          <strong>API 키 필요 시점</strong>
          <p>
            지금 페이지와 로컬 플로우 목업 구현에는 키가 필요 없습니다. 실제 FriendliAI hosted STT/LLM
            호출을 붙일 때 `FRIENDLI_TOKEN` 또는 Friendli Personal API Key를 로컬 `.env.local`에만 입력하면 됩니다.
          </p>
        </div>
      </section>

      <section className="showcase-submission" id="submission">
        <div>
          <h2>제출에서 보여줄 메시지</h2>
          <p>
            같은 제품 안에서 기업용 보안 플로우와 개인용 전체 맥락 플로우를 분리해,
            심사위원이 실제 사용 장면과 확장 방향을 한 화면에서 확인하도록 합니다.
          </p>
        </div>
        <ul>
          {submissionMessages.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
