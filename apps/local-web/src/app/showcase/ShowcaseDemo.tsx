"use client";

import { useMemo, useState } from "react";

type StageId = "ingest" | "process" | "kiya" | "miso";

type Stage = {
  id: StageId;
  number: string;
  title: string;
  caption: string;
  panelTitle: string;
  detail: string;
  result: string;
};

const stages: Stage[] = [
  {
    id: "ingest",
    number: "01",
    title: "Voice 수집",
    caption: "Channel Talk, 회의 녹음, 로컬 파일",
    panelTitle: "채널톡 통화 전사문",
    detail: "고객이 내일 오후 3시 납품 가능 여부와 대체 픽업 시간을 문의했습니다.",
    result: "source/channel-talk.payload.json"
  },
  {
    id: "process",
    number: "02",
    title: "EXAONE 후처리",
    caption: "요약, 액션아이템, 긴급도",
    panelTitle: "로컬 EXAONE 결과",
    detail: "문의 유형은 일정 조율이며 긴급도는 normal입니다. 담당자는 운영팀입니다.",
    result: "agent/exaone.local-output.json"
  },
  {
    id: "kiya",
    number: "03",
    title: "Kiya 전달",
    caption: "요약 우선, 일정 후보는 별도 확인",
    panelTitle: "Telegram Kiya 메시지",
    detail: "요약을 먼저 보내고, 일정 등록 후보가 있으면 확인/수정 버튼을 따로 제안합니다.",
    result: "agent/kiya-notification.latest.json"
  },
  {
    id: "miso",
    number: "04",
    title: "MISO 제안",
    caption: "검수 후 비식별 payload만 공개",
    panelTitle: "MISO-facing handoff",
    detail: "원문과 오디오는 포함하지 않고, 승인된 요약/액션아이템만 custom tool로 제공합니다.",
    result: "handoff/miso-payload.redacted.json"
  }
];

export function ShowcaseDemo() {
  const [activeId, setActiveId] = useState<StageId>("ingest");
  const active = useMemo(
    () => stages.find((stage) => stage.id === activeId) ?? stages[0],
    [activeId]
  );

  return (
    <section className="showcase-demo" id="demo-flow" aria-label="ixi-O Agent demo flow">
      <div className="showcase-section-head">
        <div>
          <h2>제출 데모 플로우</h2>
          <p>
            실제 고객 데이터 없이도 심사위원이 입력, 로컬 처리, 에이전트 전달,
            MISO 제안 경계를 한 번에 확인할 수 있는 mock session입니다.
          </p>
        </div>
        <a href="/api/sessions" className="showcase-text-link">
          Local API
        </a>
      </div>

      <div className="showcase-flow-grid">
        <div className="showcase-stage-list" role="tablist" aria-label="demo stages">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              role="tab"
              aria-selected={stage.id === activeId}
              className={stage.id === activeId ? "showcase-stage selected" : "showcase-stage"}
              onClick={() => setActiveId(stage.id)}
            >
              <span>{stage.number}</span>
              <strong>{stage.title}</strong>
              <em>{stage.caption}</em>
            </button>
          ))}
        </div>

        <article className="showcase-live-panel">
          <div className="showcase-panel-top">
            <div>
              <span className="showcase-label">Selected Artifact</span>
              <h3>{active.panelTitle}</h3>
            </div>
            <code>{active.result}</code>
          </div>
          <p className="showcase-panel-detail">{active.detail}</p>
          <div className="showcase-result-grid">
            <div>
              <span>raw transcript</span>
              <strong>{active.id === "miso" ? "blocked" : "local only"}</strong>
            </div>
            <div>
              <span>agent action</span>
              <strong>{active.id === "kiya" ? "propose" : active.id === "miso" ? "pull" : "prepare"}</strong>
            </div>
            <div>
              <span>review gate</span>
              <strong>{active.id === "miso" ? "approved" : "required"}</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
