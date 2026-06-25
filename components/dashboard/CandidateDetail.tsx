"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { marked } from "marked";
import { ArrowLeft, Bot, Mic, RefreshCw } from "lucide-react";
import type { DashboardCandidate } from "@/app/dashboard/data";
import {
  getChallengeReview,
  getInsights,
  getSessionScreenRecording,
  getSessionVideo,
  getTranscript,
  listSessions,
  VOICE_API_BASE,
  type BackendSession,
  type ChallengeGrade,
  type CodingChallenge,
  type RubricScore,
  type SessionInsights,
  type TranscriptTurn,
} from "@/lib/voiceAgent";
import { RubricBar } from "@/components/dashboard/RubricBar";

function statusClass(status: string) {
  if (status === "active") return "bg-[#d7ff5a] text-[#202322]";
  if (status === "processing") return "bg-[#202322] text-white";
  if (status.startsWith("error")) return "bg-[#ffe7df] text-[#80321d]";
  if (status === "done" || status === "complete") return "bg-[#e5e8df] text-[#4f564a]";
  return "bg-[#efeeeb] text-[#555a51]";
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function difficultyClass(difficulty: string) {
  if (difficulty === "Easy") return "bg-[#e3f9d5] text-[#2d4a0a]";
  if (difficulty === "Medium") return "bg-[#fff0c2] text-[#6f5314]";
  if (difficulty === "Hard") return "bg-[#ffe7df] text-[#80321d]";
  return "bg-[#ebe9e6] text-[#62675e]";
}

function scoreBadgeClass(score: number) {
  if (score <= 1) return "bg-[#ffe7df] text-[#80321d]";
  if (score === 2) return "bg-[#fff0c2] text-[#6f5314]";
  return "bg-[#d7ff5a] text-[#202322]";
}

// Cleans up the LeetCode-export editorial so it actually reads well here:
// - strips "[TOC]" and the boilerplate "Video Solution"/generic "Solution"
//   preamble headers, which point at nothing on our end
// - strips "!?!...!?!" interactive-slideshow placeholders (LeetCode-only UI,
//   never resolves to real content for us)
// - "Implementation" sections point at per-language code tabs that were lost
//   in the scrape — when nothing actually follows before the next heading,
//   the header itself gets glued onto the next one (e.g.
//   "Implementation#### Complexity Analysis"); drop the empty label
// - the scrape sometimes glues a heading directly onto the preceding
//   sentence with no line break — re-separate them
// - there's no math renderer here, so inline/block LaTeX ($...$, $$...$$)
//   is shown as monospace text instead of literal, confusing dollar signs
function cleanSolutionMarkdown(raw: string): string {
  return raw
    .replace(/^\[TOC\]\s*/i, "")
    .replace(/##\s*Video Solution[\s\S]*?---\s*##\s*Solution Article\s*\n*---/i, "")
    .replace(/^##\s*Solution\s*\n+---\s*/i, "")
    .replace(/!\?!.*?!\?!/g, "")
    .replace(/#{2,6}\s*Implementation(?=#{2,6})/gi, "")
    .replace(/([^\n#])(#{2,6}\s)/g, "$1\n\n$2")
    .replace(/\$\$([^$]+?)\$\$/g, (_, expr: string) => `\`${expr.trim()}\``)
    .replace(/\$([^$]+?)\$/g, (_, expr: string) => `\`${expr.trim()}\``)
    .trim();
}

function elapsedLabel(turnTs: number, sessionStartedAt: string) {
  const startMs = new Date(sessionStartedAt).getTime();
  if (Number.isNaN(startMs)) return "—";
  const deltaMs = Math.max(0, turnTs - startMs);
  const totalSeconds = Math.floor(deltaMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function findMatchingSession(
  sessions: BackendSession[],
  candidateName: string,
): BackendSession | null {
  const target = candidateName.trim().toLowerCase();
  const matches = sessions.filter(
    (s) => s.candidate_name.trim().toLowerCase() === target,
  );
  if (matches.length === 0) return null;
  return matches.reduce((latest, current) =>
    new Date(current.started_at).getTime() > new Date(latest.started_at).getTime()
      ? current
      : latest,
  );
}

export function CandidateDetail({ candidate }: { candidate: DashboardCandidate }) {
  const [matchedSession, setMatchedSession] = useState<BackendSession | null>(null);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const [challengeProblem, setChallengeProblem] = useState<CodingChallenge | null>(null);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeGrade, setChallengeGrade] = useState<ChallengeGrade | null>(null);
  const [challengeTab, setChallengeTab] = useState<"submission" | "solution">("submission");
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sessionsListError, setSessionsListError] = useState<string | null>(null);

  const loadDetail = useCallback(async (sessions: BackendSession[]) => {
    const match = findMatchingSession(sessions, candidate.name);
    setMatchedSession(match);

    if (!match) {
      setDetailLoading(false);
      return;
    }

    const [insightsResult, transcriptResult, videoResult, screenResult, challengeResult] =
      await Promise.allSettled([
        getInsights(match.session_id),
        getTranscript(match.session_id),
        getSessionVideo(match.session_id),
        getSessionScreenRecording(match.session_id),
        getChallengeReview(match.session_id),
      ]);
    if (insightsResult.status === "fulfilled") {
      setInsights(insightsResult.value.insights);
    }
    if (transcriptResult.status === "fulfilled") {
      setTranscript(transcriptResult.value.transcript);
    } else {
      setDetailError("Transcript not available yet — the session may still be processing.");
    }
    if (videoResult.status === "fulfilled") {
      setVideoUrl(videoResult.value.video_url);
    }
    if (screenResult.status === "fulfilled") {
      setScreenUrl(screenResult.value.video_url);
    }
    if (challengeResult.status === "fulfilled") {
      setChallengeProblem(challengeResult.value.problem);
      setChallengeCode(challengeResult.value.code);
      setChallengeGrade(challengeResult.value.grade);
    }
    setDetailLoading(false);
  }, [candidate.name]);

  const refreshSessions = useCallback(async () => {
    setDetailLoading(true);
    setSessionsListError(null);
    try {
      const data = await listSessions();
      await loadDetail(data.sessions);
    } catch {
      setSessionsListError(
        `Could not reach the voice-agent backend at ${VOICE_API_BASE}. Make sure it is running.`,
      );
      setDetailLoading(false);
    }
  }, [loadDetail]);

  const solutionHtml = useMemo(() => {
    if (!challengeProblem?.solution) return "";
    return marked.parse(cleanSolutionMarkdown(challengeProblem.solution)) as string;
  }, [challengeProblem]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        .challenge-solution h1, .challenge-solution h2, .challenge-solution h3 { font-weight: 700; margin: 0.7em 0 0.3em; color: #202322; }
        .challenge-solution h3 { font-size: 0.95rem; }
        .challenge-solution p { margin: 0.5em 0; }
        .challenge-solution ul, .challenge-solution ol { margin: 0.4em 0 0.4em 1.2em; }
        .challenge-solution li { margin: 0.2em 0; }
        .challenge-solution code { font-family: ui-monospace, monospace; background: #ebe9e6; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.85em; }
        .challenge-solution pre { background: #1c1e1c; color: #e2e2e2; padding: 0.75em 1em; border-radius: 6px; overflow-x: auto; margin: 0.6em 0; }
        .challenge-solution pre code { background: none; padding: 0; color: inherit; }
        .challenge-solution hr { border-color: #f0eeea; margin: 0.8em 0; }
      `}</style>
      <Link
        href="/dashboard/candidates"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#353a32] transition hover:text-[#111510]"
      >
        <ArrowLeft size={16} /> Back to candidates
      </Link>

      <header className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black leading-tight text-[#202322]">
            {candidate.name}
          </h1>
          <p className="mt-1 text-sm text-[#55594f]">
            {candidate.assessmentTitle}
            {matchedSession
              ? ` · ${matchedSession.problem_title} · started ${formatTime(matchedSession.started_at)}`
              : ""}
          </p>
          {matchedSession ? (
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusClass(matchedSession.status)}`}
            >
              {matchedSession.status}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refreshSessions}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[3px] border border-[#dedbd5] px-3 text-[13px] font-bold text-[#202322] transition hover:bg-[#f3f1ee]"
        >
          <RefreshCw size={15} className={detailLoading ? "animate-spin" : undefined} />
          Refresh
        </button>
      </header>

      {detailLoading ? (
        <p className="mt-6 text-sm text-[#62675e]">Loading interview…</p>
      ) : null}

      {sessionsListError ? (
        <p className="mt-4 rounded-[6px] border border-[#eadbd4] bg-[#fff8f5] px-4 py-3 text-sm text-[#7a3a27]">
          {sessionsListError}
        </p>
      ) : null}

      {!detailLoading && !matchedSession && !sessionsListError ? (
        <p className="mt-6 rounded-[8px] border border-dashed border-[#dedbd5] bg-[#faf9f7] px-5 py-8 text-center text-sm text-[#62675e]">
          Interview not started yet. {candidate.name} hasn&apos;t begun their
          assessment, or it hasn&apos;t synced to the voice-agent backend yet.
        </p>
      ) : null}

      {videoUrl || screenUrl ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {videoUrl ? (
            <div className="overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
              <p className="border-b border-[#f0eeea] px-3 py-2 text-xs font-semibold text-[#62675e]">
                Camera
              </p>
              <video controls src={videoUrl} className="w-full max-h-[360px] bg-black" />
            </div>
          ) : null}
          {screenUrl ? (
            <div className="overflow-hidden rounded-[8px] border border-[#f0eeea] bg-white">
              <p className="border-b border-[#f0eeea] px-3 py-2 text-xs font-semibold text-[#62675e]">
                Screen recording
              </p>
              <video controls src={screenUrl} className="w-full max-h-[360px] bg-black" />
            </div>
          ) : null}
        </section>
      ) : null}

      {challengeProblem ? (
        <section className="mt-6 rounded-[8px] border border-[#f0eeea] bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#202322]">
              Mid-interview coding challenge: {challengeProblem.title}
            </h2>
            {challengeGrade ? (
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${scoreBadgeClass(challengeGrade.score)}`}
              >
                {challengeGrade.score}/4
              </span>
            ) : null}
          </div>
          <span
            className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${difficultyClass(challengeProblem.difficulty)}`}
          >
            {challengeProblem.difficulty}
          </span>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#3d4239]">
            {challengeProblem.description}
          </p>
          {challengeProblem.examples.map((example) => (
            <pre
              key={example.example_num}
              className="mt-3 whitespace-pre-wrap rounded-[6px] border border-[#f0eeea] bg-[#faf9f7] p-3 font-mono text-xs text-[#3d4239]"
            >
              {example.example_text}
            </pre>
          ))}
          {challengeGrade ? (
            <p className="mt-3 text-sm text-[#3d4239]">
              <strong>Est. time complexity:</strong> {challengeGrade.time_complexity}
              <br />
              <strong>Grading notes:</strong> {challengeGrade.feedback}
            </p>
          ) : null}
          <div className="mt-4 flex items-center gap-1 border-b border-[#f0eeea]">
            <button
              type="button"
              onClick={() => setChallengeTab("submission")}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                challengeTab === "submission"
                  ? "border-b-2 border-[#202322] text-[#202322]"
                  : "text-[#9aa093] hover:text-[#62675e]"
              }`}
            >
              Candidate&apos;s response
            </button>
            <button
              type="button"
              onClick={() => setChallengeTab("solution")}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                challengeTab === "solution"
                  ? "border-b-2 border-[#202322] text-[#202322]"
                  : "text-[#9aa093] hover:text-[#62675e]"
              }`}
            >
              Reference solution
            </button>
          </div>

          {challengeTab === "submission" ? (
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre rounded-[6px] border border-[#f0eeea] bg-[#faf9f7] p-4 font-mono text-xs text-[#202322]">
              {challengeCode || "(no submission recorded)"}
            </pre>
          ) : solutionHtml ? (
            <div
              className="challenge-solution mt-3 max-h-[420px] overflow-auto rounded-[6px] border border-[#f0eeea] bg-[#faf9f7] p-4 text-sm text-[#3d4239]"
              dangerouslySetInnerHTML={{ __html: solutionHtml }}
            />
          ) : (
            <p className="mt-3 text-sm text-[#62675e]">
              No reference editorial available for this problem in the dataset.
            </p>
          )}
        </section>
      ) : null}

      {insights ? (
        <>
          <section className="mt-6 rounded-[8px] border border-[#f0eeea] bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#202322]">AI Assessment</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${insights.advance_recommend ? "bg-[#d7ff5a] text-[#202322]" : "bg-[#ffe7df] text-[#80321d]"}`}
              >
                {insights.advance_recommend ? "Advance" : "Do not advance"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#3d4239] whitespace-pre-wrap">
              {insights.summary}
            </p>
            <p className="mt-1 text-xs text-[#62675e] italic">{insights.advance_reason}</p>

            <div className="mt-4 flex gap-6 text-sm text-[#55594f]">
              <span>
                Stuck <strong className="text-[#202322]">{insights.stuck_count}×</strong>
              </span>
              <span>
                Hints <strong className="text-[#202322]">{insights.hint_count}×</strong>
              </span>
              <span>
                Rubric stage <strong className="text-[#202322]">{insights.final_stage}</strong>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#62675e]">
                  Strengths
                </p>
                <ul className="space-y-1">
                  {insights.strengths.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-full bg-[#edffd0] px-3 py-0.5 text-xs font-medium text-[#2d4a0a] inline-block mr-1 mb-1"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#62675e]">
                  Gaps
                </p>
                <ul className="space-y-1">
                  {insights.gaps.map((g, i) => (
                    <li
                      key={i}
                      className="rounded-full bg-[#ffe7df] px-3 py-0.5 text-xs font-medium text-[#80321d] inline-block mr-1 mb-1"
                    >
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {insights.rubric_scores?.length > 0 ? (
            <section className="mt-4 rounded-[8px] border border-[#f0eeea] bg-white px-5 py-4">
              <h2 className="text-base font-bold text-[#202322]">Rubric scorecard</h2>
              <ul className="mt-3 space-y-2">
                {insights.rubric_scores.map((item: RubricScore, i: number) => (
                  <li
                    key={i}
                    className="flex gap-3 items-start rounded-[6px] border border-[#f0eeea] px-3 py-2.5"
                  >
                    <RubricBar score={item.score} />
                    <div>
                      <p className="text-sm font-semibold text-[#202322]">{item.question}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#62675e]">
                        {item.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {insights.intent_map.length > 0 ? (
            <section className="mt-4">
              <h2 className="text-base font-bold text-[#202322]">Interview map</h2>
              <div className="mt-3 relative">
                <div className="absolute left-[7px] top-0 bottom-0 w-[2px] bg-[#f0eeea]" />
                <ul className="space-y-3 pl-6">
                  {insights.intent_map.map((moment, i) => {
                    const dotColor: Record<string, string> = {
                      stuck: "bg-[#ff6b4a]",
                      decision: "bg-[#d7ff5a]",
                      question: "bg-[#a8c5ff]",
                      answer: "bg-[#b8f0c8]",
                      explaining: "bg-[#e0d7ff]",
                      coding: "bg-[#ffd7a8]",
                      correction: "bg-[#ffa8d7]",
                    };
                    const color = dotColor[moment.category] ?? "bg-[#e0dedb]";
                    return (
                      <li key={i} className="relative flex gap-3 items-start">
                        <span
                          className={`absolute -left-6 mt-1 h-3.5 w-3.5 rounded-full border-2 border-white ${color}`}
                        />
                        <div>
                          <span className="text-xs font-semibold text-[#202322]">
                            {moment.label}
                          </span>
                          {moment.quote ? (
                            <p className="mt-0.5 text-xs text-[#62675e] leading-relaxed">
                              &quot;{moment.quote}&quot;
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {matchedSession ? (
        <section className="mt-6">
          <h2 className="text-lg font-bold text-[#202322]">Transcript</h2>
          {transcript.length > 0 ? (
            <div className="mt-3 space-y-3 rounded-[8px] border border-[#f0eeea] bg-white p-4">
              {transcript.map((turn, i) =>
                turn.role === "agent" ? (
                  <div key={i} className="flex gap-2">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[#7a8a3a]" />
                    <div className="max-w-[85%] rounded-lg rounded-tl-none border border-[#f0eeea] bg-[#faf9f7] px-3 py-2 text-sm leading-relaxed text-[#3d4239] whitespace-pre-wrap">
                      {turn.text}
                      <div className="mt-1 font-mono text-[10px] text-[#9aa093]">
                        {elapsedLabel(turn.ts, matchedSession.started_at)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end gap-2">
                    <div className="max-w-[85%] rounded-lg rounded-tr-none bg-[#edffd0] px-3 py-2 text-sm leading-relaxed text-[#2d4a0a] whitespace-pre-wrap">
                      {turn.text}
                      <div className="mt-1 font-mono text-[10px] text-[#5b7a2a]">
                        {elapsedLabel(turn.ts, matchedSession.started_at)}
                      </div>
                    </div>
                    <Mic className="mt-0.5 h-4 w-4 shrink-0 text-[#62675e]" />
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#62675e]">
              {detailError ?? "No transcript recorded for this session."}
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
