"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  ChevronDown,
  Clock,
  Folder,
  Loader2,
  LogOut,
  MessageSquare,
  Mic,
  X,
} from "lucide-react";
import type { CandidateAssessmentSession } from "@/app/assessment/actions";
import type { CodebaseFile } from "@/app/dashboard/data";
import { useInterviewSession } from "@/app/assessment/useInterviewSession";

const TK_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const technologyLabels: Record<string, string> = {
  python: "Python",
  react_javascript: "React",
};

const workspaceCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@keyframes tk-pulse-height { 0%, 100% { height: 4px; } 50% { height: 16px; } }
.tk-wf { animation: tk-pulse-height 1s ease-in-out infinite; }
.tk-wf:nth-child(2) { animation-delay: 0.2s; }
.tk-wf:nth-child(3) { animation-delay: 0.4s; }
.tk-wf:nth-child(4) { animation-delay: 0.6s; }
.tk-wf:nth-child(5) { animation-delay: 0.8s; }
.tk-scope { font-family: 'Inter', sans-serif; }
.tk-mono { font-family: ${TK_MONO}; }
.tk-scope ::-webkit-scrollbar { width: 8px; height: 8px; }
.tk-scope ::-webkit-scrollbar-track { background: transparent; }
.tk-scope ::-webkit-scrollbar-thumb { background: #444746; border-radius: 4px; }
.tk-scope ::-webkit-scrollbar-thumb:hover { background: #8e918f; }
`;

type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildFileTree(files: CodebaseFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let node = root;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const segmentPath = segments.slice(0, index + 1).join("/");
      let child = node.children.find(
        (candidate) => candidate.name === segment && candidate.isDir === !isLeaf,
      );

      if (!child) {
        child = { name: segment, path: segmentPath, isDir: !isLeaf, children: [] };
        node.children.push(child);
      }

      node = child;
    });
  }

  const sortNodes = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root.children;
}

function fileGlyph(name: string) {
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".py")) return "py";
  if (name.endsWith(".md")) return "md";
  if (name.endsWith(".txt")) return "··";
  return "<>";
}

function initialSeconds(session: CandidateAssessmentSession) {
  if (session.expiresAt) {
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    if (!Number.isNaN(ms)) return Math.max(0, Math.floor(ms / 1000));
  }
  return Math.max(0, session.timeLimitMinutes * 60);
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildProblemStatement(session: CandidateAssessmentSession) {
  const techs = session.technologies
    .map((tech) => technologyLabels[tech] ?? tech)
    .join(", ");
  const files = session.codeFiles.map((file) => `- ${file.path}`).join("\n");
  return [
    `This is a ${techs || "code"} walkthrough interview for "${session.title}".`,
    "",
    "The candidate has this codebase open:",
    files || "(no files provided)",
    "",
    "Ask them to walk through the code, explain key decisions, spot issues, and",
    "propose improvements. Probe their reasoning when they pause.",
  ].join("\n");
}

export function InterviewWorkspace({
  session,
}: {
  session: CandidateAssessmentSession;
}) {
  const files = session.codeFiles;
  const tree = useMemo(() => buildFileTree(files), [files]);

  const [activePath, setActivePath] = useState(files[0]?.path ?? "");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => {
    const open = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isDir) {
          open.add(node.path);
          walk(node.children);
        }
      }
    };
    walk(tree);
    return open;
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(() => initialSeconds(session));

  const { status, messages, interim, error, sessionId, start, end } =
    useInterviewSession();

  const activeFile = files.find((file) => file.path === activePath) ?? files[0] ?? null;
  const activeName = activeFile ? activeFile.path.split("/").pop() : "";
  const activeContent = activeFile
    ? edits[activeFile.path] ?? activeFile.content
    : "";

  // Always expose the latest code to the snapshot loop.
  const codeRef = useRef("");
  useEffect(() => {
    codeRef.current = activeFile
      ? `// File: ${activeFile.path}\n${activeContent}`
      : "";
  }, [activeFile, activeContent]);

  // Start the interview once when the workspace mounts.
  const startArgsRef = useRef({
    candidate_name: session.candidateName,
    problem_id: session.assessmentId,
    problem_title: session.title,
    problem_statement: buildProblemStatement(session),
  });
  useEffect(() => {
    void start({ ...startArgsRef.current, getCode: () => codeRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer.
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((value) => (value <= 0 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll the interview feed.
  const feedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages, interim]);

  function toggleDir(path: string) {
    setOpenDirs((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleEnd() {
    if (status === "ending" || status === "ended") return;
    if (!window.confirm("End the assessment and submit for review?")) return;
    await end();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  const live = status === "live";
  const dotColor =
    status === "live"
      ? "bg-[#4ade80]"
      : status === "error"
        ? "bg-[#ffb4ab]"
        : "bg-[#e5c07b]";
  const statusLabel =
    status === "live"
      ? "Recording"
      : status === "connecting"
        ? "Connecting"
        : status === "ending"
          ? "Submitting"
          : status === "ended"
            ? "Submitted"
            : status === "error"
              ? "Connection error"
              : "Idle";

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      const indent = { paddingLeft: depth * 14 + 8 };

      if (node.isDir) {
        const open = openDirs.has(node.path);
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() => toggleDir(node.path)}
              style={indent}
              className="group flex w-full items-center space-x-2 rounded px-2 py-1.5 text-left text-[#c4c7c5] transition-colors hover:bg-[#292a2a]"
            >
              <ChevronDown
                className={cx(
                  "h-4 w-4 shrink-0 text-[#8e918f] transition-transform group-hover:text-[#c4c7c5]",
                  !open && "-rotate-90",
                )}
              />
              <Folder className="h-4 w-4 shrink-0 text-[#8e918f]" />
              <span className="truncate">{node.name}</span>
            </button>
            {open ? renderNodes(node.children, depth + 1) : null}
          </div>
        );
      }

      const active = node.path === activePath;
      return (
        <button
          type="button"
          key={node.path}
          onClick={() => setActivePath(node.path)}
          style={indent}
          className={cx(
            "relative flex w-full items-center space-x-2 rounded px-2 py-1.5 text-left transition-colors",
            active
              ? "bg-[#4ade80]/10 text-[#4ade80] before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-[#4ade80] before:content-['']"
              : "text-[#c4c7c5] hover:bg-[#292a2a] hover:text-[#e2e2e2]",
          )}
        >
          <span className="tk-mono w-4 shrink-0 text-center text-xs font-bold">
            {fileGlyph(node.name)}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

  return (
    <div className="tk-scope fixed inset-0 flex flex-col overflow-hidden bg-[#0d0e0f] text-[#e2e2e2] selection:bg-[#005321] selection:text-[#6efb9b]">
      <style>{workspaceCss}</style>

      {/* Floating Recruiter Bar */}
      <div className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center space-x-3 rounded-full border border-[#444746] bg-[#343535] px-4 py-2 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className={cx("h-2 w-2 rounded-full", dotColor, live && "animate-pulse")} />
          <span className="text-xs font-medium uppercase tracking-wide text-[#e2e2e2]">
            AI Interviewer
          </span>
        </div>
        <div className="flex h-4 items-center space-x-1">
          {[8, 12, 16, 10, 6].map((height, index) => (
            <div
              key={index}
              className={cx("w-1 rounded-full bg-[#4ade80]", live && "tk-wf")}
              style={{ height: live ? `${height}px` : "4px" }}
            />
          ))}
        </div>
      </div>

      {/* Main Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#444746] bg-[#121414] px-6 py-3">
        <div className="flex min-w-0 items-center space-x-4">
          <div className="text-xl font-bold tracking-tight text-[#e2e2e2]">TALKODE</div>
          <div className="h-4 w-px bg-[#444746]" />
          <div className="truncate text-xs font-medium uppercase tracking-widest text-[#c4c7c5]">
            {session.title}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 rounded-md border border-[#444746] bg-[#1b1c1c] px-3 py-1.5">
            <Clock className="h-4 w-4 text-[#c4c7c5]" />
            <span className="tk-mono text-sm font-semibold text-[#e2e2e2]">
              {formatClock(secondsLeft)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnd}
            disabled={status === "ending" || status === "ended"}
            className="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-semibold text-[#ffb4ab] transition-colors hover:bg-[#93000a]/10 hover:text-[#ffdad6] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span>END SESSION</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {/* File Explorer Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-[#444746] bg-[#1f2020]">
          <div className="flex items-center justify-between border-b border-[#444746] p-4 text-xs font-semibold uppercase tracking-wider text-[#c4c7c5]">
            <span>Codebase</span>
            <Folder className="h-4 w-4" />
          </div>
          <div className="tk-mono flex-1 overflow-y-auto p-2 text-sm">
            {files.length > 0 ? (
              renderNodes(tree, 0)
            ) : (
              <p className="px-2 py-2 text-[#8e918f]">No files loaded.</p>
            )}
          </div>
        </aside>

        {/* Code Editor */}
        <section className="flex min-w-0 flex-1 flex-col bg-[#0d0e0f]">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#444746] bg-[#1b1c1c] px-4">
            <div className="flex h-full items-center">
              <div className="tk-mono flex h-full items-center border-b-2 border-[#4ade80] bg-[#0d0e0f] px-4 text-sm text-[#4ade80]">
                {activeName || "No file"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen((value) => !value)}
              className={cx(
                "flex items-center space-x-2 rounded border px-3 py-1.5 text-xs font-semibold transition-colors",
                panelOpen
                  ? "border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]"
                  : "border-[#4ade80]/30 text-[#4ade80] hover:bg-[#4ade80]/10",
              )}
            >
              <MessageSquare className="h-3 w-3" />
              <span>TOGGLE INTERVIEW</span>
            </button>
          </div>
          {activeFile ? (
            <textarea
              value={activeContent}
              onChange={(event) =>
                setEdits((prev) => ({
                  ...prev,
                  [activeFile.path]: event.target.value,
                }))
              }
              spellCheck={false}
              wrap="off"
              className="tk-mono flex-1 resize-none whitespace-pre bg-[#0d0e0f] p-6 text-sm leading-relaxed text-[#c4c7c5] outline-none"
            />
          ) : (
            <div className="tk-mono flex-1 p-6 text-sm text-[#8e918f]">
              No file selected.
            </div>
          )}
        </section>

        {/* Interview Panel */}
        {panelOpen ? (
          <aside className="flex w-96 shrink-0 flex-col border-l border-[#444746] bg-[#121414]">
            <div className="flex items-center justify-between border-b border-[#444746] px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#c4c7c5]">
                Interview
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "flex items-center gap-1.5 text-xs font-medium",
                    status === "error" ? "text-[#ffb4ab]" : "text-[#8e918f]",
                  )}
                >
                  <span className={cx("h-1.5 w-1.5 rounded-full", dotColor)} />
                  {statusLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="text-[#8e918f] transition-colors hover:text-[#e2e2e2]"
                  aria-label="Close interview panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && status === "connecting" ? (
                <p className="flex items-center gap-2 text-sm text-[#8e918f]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Connecting to the
                  interviewer…
                </p>
              ) : null}

              {messages.map((message) =>
                message.role === "agent" ? (
                  <div key={message.id} className="flex gap-2">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[#4ade80]" />
                    <div className="rounded-lg rounded-tl-none border border-[#444746] bg-[#1b1c1c] px-3 py-2 text-sm leading-relaxed text-[#e2e2e2] whitespace-pre-wrap">
                      {message.text}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-end gap-2">
                    <div className="rounded-lg rounded-tr-none bg-[#4ade80]/10 px-3 py-2 text-sm leading-relaxed text-[#d7ffe5] whitespace-pre-wrap">
                      {message.text}
                    </div>
                    <Mic className="mt-0.5 h-4 w-4 shrink-0 text-[#8e918f]" />
                  </div>
                ),
              )}

              {interim ? (
                <div className="flex justify-end gap-2">
                  <div className="rounded-lg rounded-tr-none border border-dashed border-[#444746] px-3 py-2 text-sm italic text-[#8e918f]">
                    {interim}
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="border-t border-[#93000a]/40 bg-[#93000a]/10 px-4 py-2 text-xs text-[#ffb4ab]">
                {error}
              </div>
            ) : null}

            <div className="border-t border-[#444746] px-4 py-2 text-[11px] text-[#5a5f57]">
              {sessionId ? `Session ${sessionId.slice(0, 8)} · ` : ""}Speak
              naturally — the interviewer responds when you pause.
            </div>
          </aside>
        ) : null}
      </main>

      {/* Submit overlay */}
      {status === "ending" || status === "ended" ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[420px] max-w-[90vw] rounded-xl border border-[#444746] bg-[#1b1c1c] p-8 text-center">
            {status === "ending" ? (
              <>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4ade80]" />
                <h2 className="mt-4 text-lg font-bold text-[#e2e2e2]">
                  Submitting your interview…
                </h2>
                <p className="mt-2 text-sm text-[#8e918f]">
                  Uploading the recording and starting analysis. Please keep this
                  tab open.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#4ade80]/15 text-[#4ade80]">
                  ✓
                </div>
                <h2 className="mt-4 text-lg font-bold text-[#e2e2e2]">
                  Interview submitted
                </h2>
                <p className="mt-2 text-sm text-[#8e918f]">
                  Your session is being processed. The recruiter will see your
                  results on their dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-6 rounded-md bg-[#4ade80] px-4 py-2 text-sm font-semibold text-[#003914] transition-colors hover:bg-[#3ccb6f]"
                >
                  Return to lobby
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
