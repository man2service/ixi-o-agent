import { listStoredVoiceSessions } from "@phone-claw/storage";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sessions = await listStoredVoiceSessions();
  const latest = sessions[0];

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Phone-Claw</p>
          <h1>일상의 모든 Voice를, 에이전트와 함께</h1>
          <p className="lede">
            Channel Talk 통화 전사문을 n8n과 로컬 브릿지로 받아, 에이전트가
            읽기 좋은 voice-session 파일로 저장합니다.
          </p>
        </div>
        <div className="status-strip" aria-label="ingest status">
          <div>
            <span className="label">세션</span>
            <strong>{sessions.length}</strong>
          </div>
          <div>
            <span className="label">최근 상태</span>
            <strong>{latest?.status ?? "empty"}</strong>
          </div>
          <div>
            <span className="label">입력</span>
            <strong>Channel Talk</strong>
          </div>
        </div>
      </section>

      <section className="workbench">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Local Inbox</p>
            <h2>수집된 Voice 세션</h2>
          </div>
          <code>private-voice-inbox/sessions</code>
        </div>

        {sessions.length === 0 ? (
          <div className="empty">
            아직 저장된 세션이 없습니다. n8n 샘플 또는 채널톡 백필을 실행하면
            여기에 표시됩니다.
          </div>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <article className="session-row" key={session.sessionId}>
                <div>
                  <div className="row-title">
                    <Link href={`/sessions/${session.sessionId}`}>
                      {formatDate(session.sourceStartedAt)}
                    </Link>
                    <code>{session.status}</code>
                  </div>
                  <p>{session.transcriptPreview || "전사문 내용 없음"}</p>
                  <dl>
                    <div>
                      <dt>발화</dt>
                      <dd>{session.utteranceCount}</dd>
                    </div>
                    <div>
                      <dt>방향</dt>
                      <dd>{session.callDirection ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt>UserChat</dt>
                      <dd>{session.userChatId ?? "unknown"}</dd>
                    </div>
                  </dl>
                </div>
                <code className="session-id">{session.sessionId}</code>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
