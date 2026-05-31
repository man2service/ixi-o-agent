const flows = {
  enterprise: {
    label: "기업용",
    headline: "채널톡 전화가 로컬에서 정리됩니다",
    summary: "검수된 payload만 MISO와 Kiya로 갑니다.",
    source: "Channel Talk",
    boundaryTitle: "기업용: 마스킹 후 전달",
    boundaryCopy: "개인정보는 로컬에 두고, 결정만 보냅니다.",
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
    label: "개인용",
    headline: "회의 녹음이 내 에이전트 기억이 됩니다",
    summary: "Voice를 안전한 업무 맥락으로 바꿉니다.",
    source: "Local recorder",
    boundaryTitle: "개인용: 전체 맥락 전달",
    boundaryCopy: "마스킹 없이 내 에이전트에게 보냅니다.",
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

let activeMode = "enterprise";
let activeStepIndex = 0;

const modeButtons = document.querySelectorAll("[data-mode]");
const stageList = document.querySelector("#stage-list");
const previousButton = document.querySelector("#previous-step");
const nextButton = document.querySelector("#next-step");
const heroNextButton = document.querySelector("#hero-next-step");
const maskPreview = document.querySelector("#mask-preview");

const fields = {
  heroModeLabel: document.querySelector("#hero-mode-label"),
  heroSource: document.querySelector("#hero-source"),
  heroSummary: document.querySelector("#hero-summary"),
  heroBoundaryTitle: document.querySelector("#hero-boundary-title"),
  heroStepResult: document.querySelector("#hero-step-result"),
  heroAgentOutput: document.querySelector("#hero-agent-output"),
  heroStepDetail: document.querySelector("#hero-step-detail"),
  flowSource: document.querySelector("#flow-source"),
  flowTitle: document.querySelector("#flow-title"),
  flowProgress: document.querySelector("#flow-progress"),
  flowProgressBar: document.querySelector("#flow-progress-bar"),
  flowStatus: document.querySelector("#flow-status"),
  stageEvent: document.querySelector("#stage-event"),
  stageTitle: document.querySelector("#stage-title"),
  stageDetail: document.querySelector("#stage-detail"),
  stageResult: document.querySelector("#stage-result"),
  stageNext: document.querySelector("#stage-next")
};

function render() {
  const flow = flows[activeMode];
  const step = flow.steps[activeStepIndex];
  const progress = Math.round(((activeStepIndex + 1) / flow.steps.length) * 100);

  fields.heroModeLabel.textContent = flow.label;
  fields.heroSource.textContent = flow.source;
  fields.heroSummary.textContent = flow.summary;
  fields.heroBoundaryTitle.textContent = flow.boundaryTitle;
  fields.heroStepResult.textContent = step.result;
  fields.heroAgentOutput.textContent = flow.agentHandoff[0];
  fields.heroStepDetail.textContent = step.detail;
  fields.flowSource.textContent = flow.source;
  fields.flowTitle.textContent = flow.headline;
  fields.flowProgress.textContent = `${progress}%`;
  fields.flowProgressBar.style.width = `${progress}%`;
  fields.flowStatus.textContent = step.status;
  fields.stageEvent.textContent = step.eventLabel;
  fields.stageTitle.textContent = step.title;
  fields.stageDetail.textContent = step.detail;
  fields.stageResult.textContent = step.result;
  fields.stageNext.textContent = flow.agentHandoff.join(" / ");

  maskPreview.hidden = activeMode !== "enterprise";

  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === activeMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  stageList.innerHTML = "";
  flow.steps.forEach((stage, index) => {
    const button = document.createElement("button");
    const state =
      index < activeStepIndex ? "completed" : index === activeStepIndex ? "selected" : "upcoming";
    button.type = "button";
    button.className = `stage ${state}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === activeStepIndex));
    button.innerHTML = `<span>${stage.number}</span><strong>${stage.title}</strong><em>${stage.eventLabel}</em>`;
    button.addEventListener("click", () => {
      activeStepIndex = index;
      render();
    });
    stageList.append(button);
  });

  previousButton.disabled = activeStepIndex === 0;
  nextButton.textContent = activeStepIndex === flow.steps.length - 1 ? "처음" : "다음";
}

function switchMode(mode) {
  activeMode = mode;
  activeStepIndex = 0;
  render();
}

function nextStep() {
  const flow = flows[activeMode];
  activeStepIndex = activeStepIndex === flow.steps.length - 1 ? 0 : activeStepIndex + 1;
  render();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

previousButton.addEventListener("click", () => {
  activeStepIndex = Math.max(activeStepIndex - 1, 0);
  render();
});

nextButton.addEventListener("click", nextStep);
heroNextButton.addEventListener("click", nextStep);

render();
