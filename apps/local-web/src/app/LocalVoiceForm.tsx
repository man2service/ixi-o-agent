"use client";

import { useEffect, useRef, useState } from "react";

type RecordingState = "idle" | "recording" | "ready" | "unsupported" | "error";

export function LocalVoiceForm() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingLabel, setRecordingLabel] = useState("녹음 파일 없음");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!("mediaDevices" in navigator) || typeof MediaRecorder === "undefined") {
      setRecordingState("unsupported");
      setRecordingLabel("브라우저 녹음 미지원");
    }

    return () => {
      stopTracks();
    };
  }, []);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingState("unsupported");
      setRecordingLabel("브라우저 녹음 미지원");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], buildRecordingFileName(mimeType), { type: mimeType });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (fileInputRef.current) {
          fileInputRef.current.files = dataTransfer.files;
        }
        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        setRecordingLabel(`${seconds}초 녹음 완료 / ${formatBytes(file.size)}`);
        setRecordingState("ready");
        stopTracks();
      };

      recorder.start();
      setRecordingState("recording");
      setRecordingLabel("녹음 중");
    } catch (recordingError) {
      setRecordingState("error");
      setError(recordingError instanceof Error ? recordingError.message : "microphone_permission_failed");
      stopTracks();
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function handleFileChange() {
    const file = fileInputRef.current?.files?.[0];
    setRecordingLabel(file ? `${file.name} / ${formatBytes(file.size)}` : "녹음 파일 없음");
    setRecordingState(file ? "ready" : "idle");
  }

  return (
    <form className="local-form" action="/api/ingest/local-voice" method="post" encType="multipart/form-data">
      <div className="form-row">
        <label>
          <span>제목</span>
          <input name="title" placeholder="회의 또는 음성 메모" />
        </label>
        <label>
          <span>모드</span>
          <select name="mode" defaultValue="meeting">
            <option value="meeting">회의</option>
            <option value="call">통화</option>
            <option value="voice_note">음성 메모</option>
          </select>
        </label>
      </div>
      <label>
        <span>로컬 전사문</span>
        <textarea
          name="transcriptText"
          rows={4}
          placeholder="오늘 회의에서 논의한 내용, 후속 액션, 확인할 질문을 입력"
        />
      </label>
      <div className="recorder-panel">
        <div>
          <span className="label">브라우저 녹음</span>
          <strong>{recordingLabel}</strong>
        </div>
        <div className="recorder-actions">
          <button
            className="button secondary"
            type="button"
            onClick={startRecording}
            disabled={recordingState === "recording" || recordingState === "unsupported"}
            aria-pressed={recordingState === "recording"}
          >
            녹음 시작
          </button>
          <button
            className="button"
            type="button"
            onClick={stopRecording}
            disabled={recordingState !== "recording"}
          >
            녹음 정지
          </button>
        </div>
        {error ? <p className="hint warning-text">마이크 접근 실패: {error}</p> : null}
      </div>
      <label>
        <span>오디오 파일</span>
        <input
          ref={fileInputRef}
          name="audioFile"
          type="file"
          accept="audio/*,video/*"
          onChange={handleFileChange}
        />
      </label>
      <button className="button primary local-submit" type="submit">
        로컬 세션 만들기
      </button>
    </form>
  );
}

function buildRecordingFileName(mimeType: string): string {
  const extension = mimeType.includes("mp4") || mimeType.includes("mpeg") ? "m4a" : "webm";
  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
  return `phone-claw-recording-${timestamp}.${extension}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
