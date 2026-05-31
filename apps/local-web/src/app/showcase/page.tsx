import Link from "next/link";
import { ShowcaseDemo } from "./ShowcaseDemo";

const sessionRows = [
  {
    channel: "Channel Talk",
    mode: "call",
    status: "pending review",
    summary: "고객이 내일 오후 3시 픽업 가능 여부와 대체 시간을 문의했습니다."
  },
  {
    channel: "Private Mode",
    mode: "meeting",
    status: "kiya sent",
    summary: "OBA 제출 전 최종 점검 미팅을 캘린더 후보로 제안했습니다."
  },
  {
    channel: "Future ixi-O",
    mode: "call",
    status: "planned",
    summary: "통화 앱 연동 시 동일한 voice-session 계약으로 확장합니다."
  }
];

const checklist = [
  "LG U+ Track: Voice AI 사례와 EXAONE 활용을 화면 첫 흐름에서 명확히 보여줍니다.",
  "MISO Track: 직접 push가 아니라 custom tool/OpenAPI와 inbound schema 제안을 분리합니다.",
  "Security: raw audio와 raw transcript는 로컬에 두고, 검수된 redacted payload만 외부에 엽니다.",
  "Demo: 실제 고객 통화 없이도 mock session으로 전체 흐름을 설명할 수 있습니다."
];

export const metadata = {
  title: "Phone-Claw Showcase",
  description: "Submission-ready Phone-Claw demo mockup"
};

export default function ShowcasePage() {
  return (
    <main className="showcase-shell">
      <nav className="showcase-nav" aria-label="showcase navigation">
        <Link href="/showcase" className="showcase-brand">
          <span>PC</span>
          Phone-Claw
        </Link>
        <div>
          <a href="#demo-flow">Demo</a>
          <a href="#architecture">Architecture</a>
          <a href="#submission">Submission</a>
          <a href="https://github.com/man2service/Phoneclaw">GitHub</a>
        </div>
      </nav>

      <section className="showcase-hero">
        <div className="showcase-hero-copy">
          <h1>일상의 모든 Voice를, 에이전트와 함께</h1>
          <p>
            Phone-Claw는 통화와 회의에서 생긴 음성 맥락을 로컬에서 전사/요약하고,
            Kiya와 MISO 같은 업무 에이전트가 안전하게 읽을 수 있는 작업 단위로 바꿉니다.
          </p>
          <div className="showcase-actions">
            <a className="showcase-primary" href="#demo-flow">
              데모 플로우 보기
            </a>
            <a className="showcase-secondary" href="https://github.com/man2service/Phoneclaw">
              GitHub 보기
            </a>
          </div>
        </div>

        <div className="showcase-product" aria-label="Phone-Claw product preview">
          <div className="showcase-product-header">
            <span>Live mock session</span>
            <strong>approved_for_external_workflow</strong>
          </div>
          <figure className="showcase-product-visual">
            <img
              src="/assets/phone-claw-voice-bridge.png"
              alt="Phone-Claw voice bridge concept dashboard"
            />
          </figure>
          <div className="showcase-product-grid">
            <article>
              <span>Channel Talk</span>
              <p>내일 오후 3시 픽업 일정 확인 요청</p>
            </article>
            <article>
              <span>EXAONE Local</span>
              <p>요약, 긴급도, 액션아이템 생성</p>
            </article>
            <article>
              <span>Kiya Telegram</span>
              <p>요약 전송 후 캘린더 후보 확인</p>
            </article>
            <article>
              <span>MISO Handoff</span>
              <p>검수된 비식별 payload만 공개</p>
            </article>
          </div>
        </div>
      </section>

      <ShowcaseDemo />

      <section className="showcase-architecture" id="architecture">
        <div className="showcase-section-head">
          <div>
            <h2>아키텍처 요약</h2>
            <p>Vercel 페이지는 제출용 mockup이고, 실제 민감 처리는 로컬 Mac mini에서 실행합니다.</p>
          </div>
        </div>
        <div className="showcase-architecture-line">
          <div>
            <span>Input</span>
            <strong>Channel Talk / Meeting / Future ixi-O</strong>
          </div>
          <div>
            <span>Local Bridge</span>
            <strong>n8n + Phone-Claw storage</strong>
          </div>
          <div>
            <span>Local AI</span>
            <strong>Whisper small + EXAONE 1.2B</strong>
          </div>
          <div>
            <span>Agent</span>
            <strong>Kiya summary + calendar command</strong>
          </div>
          <div>
            <span>Workflow</span>
            <strong>MISO custom tool proposal</strong>
          </div>
        </div>
      </section>

      <section className="showcase-session">
        <div className="showcase-section-head">
          <div>
            <h2>Mock 세션 인박스</h2>
            <p>실제 제출 페이지에서는 아래처럼 비식별 샘플만 보여주고, 원문은 로컬 데모에서 확인합니다.</p>
          </div>
        </div>
        <div className="showcase-table" role="table" aria-label="mock voice sessions">
          <div className="showcase-table-row header" role="row">
            <span>Source</span>
            <span>Mode</span>
            <span>Status</span>
            <span>Redacted summary</span>
          </div>
          {sessionRows.map((row) => (
            <div className="showcase-table-row" role="row" key={`${row.channel}-${row.mode}`}>
              <span>{row.channel}</span>
              <span>{row.mode}</span>
              <span>{row.status}</span>
              <span>{row.summary}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="showcase-submission" id="submission">
        <div>
          <h2>제출에서 보여줄 메시지</h2>
          <p>
            “음성은 어디에서 오든 같은 voice-session 계약으로 들어오고, 민감한 처리는 로컬에서 끝내며,
            에이전트에는 검수된 작업 맥락만 전달한다”는 점을 가장 앞에 둡니다.
          </p>
        </div>
        <ul>
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
