"use client";

import { useState } from "react";

type ModeId = "enterprise" | "personal";

type FlowStep = {
  number: string;
  title: string;
  eventLabel: string;
  detail: string;
  result: string;
  status: string;
};

type FlowMode = {
  id: ModeId;
  label: string;
  headline: string;
  summary: string;
  source: string;
  boundaryTitle: string;
  boundaryCopy: string;
  localOnly: string[];
  agentHandoff: string[];
  steps: FlowStep[];
};

const flows: Record<ModeId, FlowMode> = {
  enterprise: {
    id: "enterprise",
    label: "기업용",
    headline: "채널톡 전화가 로컬에서 정리됩니다",
    summary: "검수된 payload만 MISO와 Kiya로 갑니다.",
    source: "Channel Talk",
    boundaryTitle: "기업용: 마스킹 후 전달",
    boundaryCopy: "개인정보는 로컬에 두고, 결정만 보냅니다.",
    localOnly: ["원문", "전화번호", "이름/주소"],
    agentHandoff: ["요약", "결정", "다음 액션"],
    steps: [
      {
        number: "01",
        title: "수집",
        eventLabel: "Channel Talk",
        detail: "전화 이벤트가 n8n으로 들어옵니다.",
        result: "로컬 inbox 생성",
        status: "수집"
      },
      {
        number: "02",
        title: "로컬 처리",
        eventLabel: "Whisper + EXAONE",
        detail: "로컬 STT/EXAONE이 정리합니다.",
        result: "요약 초안 생성",
        status: "처리"
      },
      {
        number: "03",
        title: "마스킹",
        eventLabel: "Privacy gate",
        detail: "전화번호와 이름을 지웁니다.",
        result: "검수 대기",
        status: "검수"
      },
      {
        number: "04",
        title: "전달",
        eventLabel: "Kiya / MISO",
        detail: "필요한 결정만 에이전트가 읽습니다.",
        result: "액션 제안",
        status: "전달"
      }
    ]
  },
  personal: {
    id: "personal",
    label: "개인용",
    headline: "회의 녹음이 내 에이전트 기억이 됩니다",
    summary: "Voice를 안전한 업무 맥락으로 바꿉니다.",
    source: "Local recorder",
    boundaryTitle: "개인용: 전체 맥락 전달",
    boundaryCopy: "마스킹 없이 내 에이전트에게 보냅니다.",
    localOnly: ["음성 파일", "전사문", "개인 메모"],
    agentHandoff: ["전체 요약", "전체 전사", "일정 후보"],
    steps: [
      {
        number: "01",
        title: "녹음",
        eventLabel: "Voice",
        detail: "회의나 통화를 녹음합니다.",
        result: "음성 파일 저장",
        status: "녹음"
      },
      {
        number: "02",
        title: "전사",
        eventLabel: "Whisper",
        detail: "로컬 STT가 전사합니다.",
        result: "전사문 생성",
        status: "전사"
      },
      {
        number: "03",
        title: "요약",
        eventLabel: "EXAONE",
        detail: "에이전트가 바로 읽게 정리합니다.",
        result: "액션 후보 생성",
        status: "요약"
      },
      {
        number: "04",
        title: "확인",
        eventLabel: "Kiya",
        detail: "실행 전 한 번 더 묻습니다.",
        result: "확인 후 실행",
        status: "확인"
      }
    ]
  }
};

const problemBeats = [
  { title: "통화는 흩어지고", detail: "상담, 회의, 음성 메모가 각자 다른 곳에 남습니다." },
  { title: "회의는 잊히고", detail: "결정과 할 일이 사람 기억에만 의존합니다." },
  { title: "에이전트는 맥락을 모릅니다", detail: "업무 에이전트는 음성 원문보다 안전한 업무 맥락이 필요합니다." }
];

const coreStages = [
  { number: "01", title: "Voice", detail: "통화/음성 입력" },
  { number: "02", title: "Local AI", detail: "로컬 STT & 요약" },
  { number: "03", title: "Agent", detail: "다음 행동 제안" }
];

const trackProof = [
  { title: "LG U+", detail: "Voice AI + EXAONE" },
  { title: "GS네오텍 / MISO", detail: "안전한 inbound voice context" },
  { title: "Local-first", detail: "Mac mini 로컬 처리" }
];

const maskPreview = [
  { label: "전화번호", value: "010-****-8100" },
  { label: "이름", value: "김**" },
  { label: "주소", value: "서울 **구" }
];

export function ShowcaseDemo() {
  const [activeMode, setActiveMode] = useState<ModeId>("enterprise");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const flow = flows[activeMode];
  const activeStep = flow.steps[activeStepIndex] ?? flow.steps[0];
  const progress = Math.round(((activeStepIndex + 1) / flow.steps.length) * 100);

  function switchMode(mode: ModeId) {
    setActiveMode(mode);
    setActiveStepIndex(0);
  }

  function nextStep() {
    setActiveStepIndex((current) => Math.min(current + 1, flow.steps.length - 1));
  }

  function previousStep() {
    setActiveStepIndex((current) => Math.max(current - 1, 0));
  }

  const modeSwitch = (className = "showcase-mode-switch") => (
    <div className={className} role="tablist" aria-label="mode switch">
      {Object.values(flows).map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="tab"
          aria-selected={mode.id === activeMode}
          className={
            mode.id === activeMode ? "showcase-mode-button selected" : "showcase-mode-button"
          }
          onClick={() => switchMode(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section className="showcase-hero showcase-hero-stage" id="experience" aria-label="ixi-O Agent demo">
        <div className="showcase-hero-copy showcase-hero-centered">
          <h1>
            일상의 Voice를
            <span>에이전트와 함께</span>
          </h1>
          <p>
            사용자는 통화만 하세요.
            <span>ixi-O-agent가 다음을 책임질게요</span>
          </p>

          {modeSwitch("showcase-mode-switch showcase-mode-switch-hero")}
        </div>

        <div className="showcase-stage-frame" aria-label={`${flow.label} voice to agent stage`}>
          <aside className="showcase-frame-sidebar">
            <span className="showcase-label">{flow.label}</span>
            <strong>{flow.source}</strong>
            <p>{flow.summary}</p>
            <ul>
              <li>{flow.boundaryTitle}</li>
              <li>{activeStep.result}</li>
            </ul>
            {activeMode === "enterprise" ? (
              <div className="showcase-mask-preview" aria-label="masked enterprise fields">
                {maskPreview.map((item) => (
                  <span key={item.label}>
                    <em>{item.label}</em>
                    {item.value}
                  </span>
                ))}
              </div>
            ) : null}
          </aside>

          <div className="showcase-frame-path">
            {coreStages.map((stage) => (
              <article key={stage.number} className="showcase-frame-node">
                <span>{stage.number}</span>
                <strong>{stage.title}</strong>
                <p>{stage.detail}</p>
              </article>
            ))}
          </div>

          <aside className="showcase-frame-output">
            <span className="showcase-label">Agent proposal</span>
            <strong>{flow.agentHandoff[0]}</strong>
            <p>{activeStep.detail}</p>
            <button type="button" onClick={nextStep}>
              다음 단계 보기
            </button>
          </aside>
        </div>

        <a className="showcase-scroll-hint" href="#problem">
          통화가 들어오면
        </a>
      </section>

      <section className="showcase-problem" id="problem" aria-label="problem">
        {problemBeats.map((beat) => (
          <article key={beat.title}>
            <h2>{beat.title}</h2>
            <p>{beat.detail}</p>
          </article>
        ))}
      </section>

      <section className="showcase-demo" id="guided-flow" aria-label="guided flow">
        <div className="showcase-section-head showcase-flow-head">
          <div>
            <h2>Voice 수집에서 액션 제안까지</h2>
            <p>발표자는 아래 단계만 넘기면 전체 흐름을 보여줄 수 있습니다.</p>
          </div>
          {modeSwitch()}
        </div>

        <div className="showcase-experience-card">
          <div className="showcase-experience-summary">
            <div>
              <span className="showcase-label">{flow.source}</span>
              <h3>{flow.headline}</h3>
            </div>
            <div className="showcase-progress-box" aria-label="flow progress">
              <span>{progress}%</span>
              <div className="showcase-progress-track">
                <div style={{ width: `${progress}%` }} />
              </div>
              <strong>{activeStep.status}</strong>
            </div>
          </div>

          <div className="showcase-flow-grid">
            <div>
              <div className="showcase-stage-list" role="tablist" aria-label={`${flow.label} stages`}>
                {flow.steps.map((stage, index) => {
                  const state =
                    index < activeStepIndex
                      ? "completed"
                      : index === activeStepIndex
                        ? "selected"
                        : "upcoming";
                  return (
                    <button
                      key={`${flow.id}-${stage.number}`}
                      type="button"
                      role="tab"
                      aria-selected={index === activeStepIndex}
                      className={`showcase-stage ${state}`}
                      onClick={() => setActiveStepIndex(index)}
                    >
                      <span>{stage.number}</span>
                      <strong>{stage.title}</strong>
                      <em>{stage.eventLabel}</em>
                    </button>
                  );
                })}
              </div>

              <div className="showcase-step-controls">
                <button
                  type="button"
                  className="showcase-control"
                  onClick={previousStep}
                  disabled={activeStepIndex === 0}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="showcase-control primary"
                  onClick={activeStepIndex === flow.steps.length - 1 ? () => setActiveStepIndex(0) : nextStep}
                >
                  {activeStepIndex === flow.steps.length - 1 ? "처음" : "다음"}
                </button>
              </div>
            </div>

            <article className="showcase-live-panel">
              <div className="showcase-panel-top">
                <div>
                  <span className="showcase-label">{activeStep.eventLabel}</span>
                  <h3>{activeStep.title}</h3>
                </div>
              </div>
              <p className="showcase-panel-detail">{activeStep.detail}</p>
              <div className="showcase-result-grid">
                <div>
                  <span>Result</span>
                  <strong>{activeStep.result}</strong>
                </div>
                <div>
                  <span>Next</span>
                  <strong>{flow.agentHandoff.join(" / ")}</strong>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="showcase-mode-split" aria-label="enterprise and personal modes">
        {Object.values(flows).map((mode) => (
          <article key={mode.id}>
            <span>{mode.label}</span>
            <h2>{mode.boundaryTitle}</h2>
            <p>{mode.boundaryCopy}</p>
            {mode.id === "enterprise" ? (
              <div className="showcase-mask-flow" aria-label="enterprise masking example">
                <strong>010-1234-5678</strong>
                <em>mask</em>
                <strong>010-****-8100</strong>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="showcase-security-section" id="security" aria-label="security boundary">
        <div className="showcase-section-head">
          <div>
            <h2>보안 경계</h2>
            <p>기업용은 원문을 로컬에 두고, 검수된 payload만 MISO와 Kiya로 보냅니다.</p>
          </div>
        </div>

        <div className="showcase-boundary showcase-boundary-large" aria-label="privacy boundary">
          <div>
            <span>Local only</span>
            <ul>
              {flows.enterprise.localOnly.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="showcase-boundary-arrow">review</div>
          <div>
            <span>Agent handoff</span>
            <ul>
              {flows.enterprise.agentHandoff.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="showcase-track-proof" aria-label="track proof">
        {trackProof.map((item) => (
          <article key={item.title}>
            <span>{item.title}</span>
            <strong>{item.detail}</strong>
          </article>
        ))}
      </section>
    </>
  );
}
