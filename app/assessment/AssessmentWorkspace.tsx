"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Clock,
  Code2,
  FileText,
  Folder,
  LogOut,
  Moon,
  Sun,
  X,
} from "lucide-react";
import type { CandidateAssessmentSession } from "@/app/assessment/actions";
import type { CodebaseFile } from "@/app/dashboard/data";

type WorkspaceTheme = "dark" | "light";
type MediaStatus = "idle" | "checking" | "ready" | "blocked";

export type AssessmentMediaControls = {
  audioLevel: number;
  audioStatus: MediaStatus;
  cameraStatus: MediaStatus;
  runChecks: () => Promise<void>;
  stopMedia: () => void;
  videoStream: MediaStream | null;
};

type TreeNode = {
  children: TreeNode[];
  isDir: boolean;
  name: string;
  path: string;
};

type SyntaxPalette = {
  base: string;
  comment: string;
  functionName: string;
  keyword: string;
  literal: string;
  number: string;
  punctuation: string;
  string: string;
};

const workspaceCss = `
.ch-workspace { font-family: var(--font-plus-jakarta), Arial, Helvetica, sans-serif; }
.ch-mono { font-family: var(--font-plus-jakarta), Arial, Helvetica, sans-serif; }
.ch-workspace ::-webkit-scrollbar { width: 9px; height: 9px; }
.ch-workspace ::-webkit-scrollbar-track { background: transparent; }
.ch-workspace ::-webkit-scrollbar-thumb { background: var(--ch-scrollbar); border-radius: 3px; }
.ch-workspace ::-webkit-scrollbar-thumb:hover { background: var(--ch-scrollbar-hover); }
`;

const themeTokens = {
  dark: {
    root:
      "bg-[#101211] text-[#e8ebe3] selection:bg-white selection:text-[#111510]",
    header: "border-[#2d312b] bg-[#151816]",
    panel: "border-[#2d312b] bg-[#1c1f1c]",
    panelSoft: "border-[#2d312b] bg-[#151816]",
    canvas: "bg-[#0d0f0e]",
    canvasSoft: "bg-[#111410]",
    text: "text-[#e8ebe3]",
    muted: "text-[#a7aca1]",
    faint: "text-[#73786f]",
    hover: "hover:bg-[#252a23]",
    active: "bg-white/10 text-white",
    line: "border-[#2d312b]",
    button:
      "border-[#3b4237] text-[#e8ebe3] hover:border-[#596150] hover:bg-[#242922]",
    danger: "text-[#ffb4ab] hover:bg-[#93000a]/12 hover:text-[#ffdad6]",
    tab: "border-[#2d312b] bg-[#171a17] text-[#a7aca1]",
    tabActive: "border-white bg-[#0d0f0e] text-white",
    input: "bg-[#0d0f0e] text-[#e8ebe3] placeholder:text-[#62675e]",
    codeLine: "border-[#252a23] text-[#65705d]",
    mdSurface: "bg-[#131613]",
    scrollbar: "#3d4339",
    scrollbarHover: "#656d5e",
  },
  light: {
    root:
      "bg-[#fbfaf7] text-[#202322] selection:bg-white selection:text-[#111510]",
    header: "border-[#dedbd5] bg-white",
    panel: "border-[#dedbd5] bg-white",
    panelSoft: "border-[#e7e4de] bg-[#f5f3ef]",
    canvas: "bg-white",
    canvasSoft: "bg-[#fbfaf7]",
    text: "text-[#202322]",
    muted: "text-[#62675e]",
    faint: "text-[#858a80]",
    hover: "hover:bg-[#efede8]",
    active: "bg-white text-[#202322]",
    line: "border-[#dedbd5]",
    button:
      "border-[#d8d5cf] text-[#202322] hover:border-[#c7c2ba] hover:bg-[#fbfaf7]",
    danger: "text-red-700 hover:bg-red-50 hover:text-red-800",
    tab: "border-[#dedbd5] bg-[#f5f3ef] text-[#62675e]",
    tabActive: "border-[#202322] bg-white text-[#202322]",
    input: "bg-white text-[#202322] placeholder:text-[#858a80]",
    codeLine: "border-[#ece9e3] text-[#9a9f94]",
    mdSurface: "bg-white",
    scrollbar: "#c9c5bd",
    scrollbarHover: "#969086",
  },
} satisfies Record<WorkspaceTheme, Record<string, string>>;

const syntaxPalettes: Record<WorkspaceTheme, SyntaxPalette> = {
  dark: {
    base: "#d8ddd1",
    comment: "#7b8377",
    functionName: "#ffd866",
    keyword: "#65d6ff",
    literal: "#c792ea",
    number: "#f4bf75",
    punctuation: "#b6bcb0",
    string: "#ffffff",
  },
  light: {
    base: "#202322",
    comment: "#6f756c",
    functionName: "#8a5a00",
    keyword: "#005ea8",
    literal: "#6b3fb4",
    number: "#9c4a00",
    punctuation: "#5d6258",
    string: "#202322",
  },
};

const languageKeywords: Record<string, Set<string>> = {
  javascript: new Set([
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "let",
    "new",
    "return",
    "switch",
    "throw",
    "try",
    "typeof",
    "useEffect",
    "useMemo",
    "useState",
    "while",
  ]),
  json: new Set(["false", "null", "true"]),
  python: new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "async",
    "await",
    "class",
    "def",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "with",
    "yield",
  ]),
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildFileTree(files: CodebaseFile[]): TreeNode[] {
  const root: TreeNode = { children: [], isDir: true, name: "", path: "" };

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
        child = {
          children: [],
          isDir: !isLeaf,
          name: segment,
          path: segmentPath,
        };
        node.children.push(child);
      }

      node = child;
    });
  }

  const sortNodes = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root.children;
}

function fileGlyph(name: string) {
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".jsx") || name.endsWith(".js")) return "js";
  if (name.endsWith(".md")) return "md";
  if (name.endsWith(".py")) return "py";
  if (name.endsWith(".txt")) return "txt";
  return "<>";
}

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

function languageForFile(file: CodebaseFile) {
  const path = file.path.toLowerCase();
  const language = file.language.toLowerCase();

  if (path.endsWith(".md") || language.includes("markdown")) return "markdown";
  if (path.endsWith(".py") || language.includes("python")) return "python";
  if (
    path.endsWith(".js") ||
    path.endsWith(".jsx") ||
    language.includes("javascript")
  ) {
    return "javascript";
  }
  if (path.endsWith(".json") || language.includes("json")) return "json";
  return "text";
}

function initialSeconds(session: CandidateAssessmentSession) {
  return Math.max(0, session.timeLimitMinutes * 60);
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pushTextNode(
  nodes: ReactNode[],
  key: string,
  text: string,
  style?: CSSProperties,
) {
  if (!text) return;
  nodes.push(
    <span key={key} style={style}>
      {text}
    </span>,
  );
}

function commentIndex(line: string, language: string) {
  if (language === "python") {
    return line.indexOf("#");
  }

  if (language === "javascript") {
    return line.indexOf("//");
  }

  return -1;
}

function highlightCodeLine(
  line: string,
  language: string,
  palette: SyntaxPalette,
) {
  const nodes: ReactNode[] = [];
  const commentStart = commentIndex(line, language);
  const code =
    commentStart >= 0 ? line.slice(0, commentStart) : line;
  const comment =
    commentStart >= 0 ? line.slice(commentStart) : "";
  const keywords = languageKeywords[language] ?? new Set<string>();
  const tokenPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[{}()[\].,:;+\-*/%=<>!&|]+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(code))) {
    const [token] = match;
    const start = match.index;
    pushTextNode(nodes, `plain-${start}`, code.slice(cursor, start));

    let color = palette.base;
    if (/^["'`]/.test(token)) {
      color = palette.string;
    } else if (/^\d/.test(token)) {
      color = palette.number;
    } else if (keywords.has(token)) {
      color = palette.keyword;
    } else if (["true", "false", "null", "None", "True", "False"].includes(token)) {
      color = palette.literal;
    } else if (/^[{}()[\].,:;+\-*/%=<>!&|]+$/.test(token)) {
      color = palette.punctuation;
    } else if (code.slice(tokenPattern.lastIndex).trimStart().startsWith("(")) {
      color = palette.functionName;
    }

    pushTextNode(nodes, `token-${start}`, token, { color });
    cursor = start + token.length;
  }

  pushTextNode(nodes, "tail", code.slice(cursor));
  pushTextNode(nodes, "comment", comment, {
    color: palette.comment,
    fontStyle: "italic",
  });

  return nodes.length > 0 ? nodes : " ";
}

function renderInlineMarkdown(text: string, theme: WorkspaceTheme) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  const t = themeTokens[theme];

  return tokens.map((token, index) => {
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          className={cx(
            "ch-mono rounded-[3px] border px-1.5 py-0.5 text-[0.92em]",
            t.panelSoft,
          )}
          key={`${token}-${index}`}
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong className={t.text} key={`${token}-${index}`}>
          {token.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function MarkdownPreview({
  content,
  theme,
}: {
  content: string;
  theme: WorkspaceTheme;
}) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  const t = themeTokens[theme];
  let index = 0;
  let orderedIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);

    if (line.trim().startsWith("```")) {
      const fenceLanguage = line.trim().replace(/```/, "") || "text";
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(
        <div
          className={cx("my-4 overflow-hidden rounded-[6px] border", t.line)}
          key={`fence-${index}`}
        >
          <div className={cx("border-b px-3 py-1.5 text-[11px]", t.line, t.muted)}>
            {fenceLanguage}
          </div>
          <pre className="ch-mono overflow-auto bg-[#111510] p-3 text-xs leading-6 text-[#f8f8f2]">
            {codeLines.map((codeLine, lineIndex) => (
              <div key={`${codeLine}-${lineIndex}`}>
                {highlightCodeLine(
                  codeLine,
                  fenceLanguage,
                  syntaxPalettes.dark,
                )}
              </div>
            ))}
          </pre>
        </div>,
      );
    } else if (heading) {
      const level = heading[1].length;
      blocks.push(
        <div
          className={cx(
            "mt-5 border-b pb-2 font-black",
            level <= 1 ? "text-2xl" : level === 2 ? "text-xl" : "text-base",
            t.line,
            t.text,
          )}
          key={`heading-${index}`}
        >
          {heading[2]}
        </div>,
      );
    } else if (bullet || ordered) {
      const listMarker = ordered ? `${(orderedIndex += 1)}.` : "-";
      blocks.push(
        <div
          className={cx("grid grid-cols-[22px_1fr] gap-2 py-0.5 text-xs", t.text)}
          key={`list-${index}`}
        >
          <span className={cx("text-right", t.faint)}>{listMarker}</span>
          <span>{renderInlineMarkdown((bullet ?? ordered)?.[1] ?? "", theme)}</span>
        </div>,
      );
    } else if (line.trim().length === 0) {
      blocks.push(<div className="h-3" key={`space-${index}`} />);
    } else {
      blocks.push(
        <p className={cx("py-0.5 text-xs leading-6", t.text)} key={`p-${index}`}>
          {renderInlineMarkdown(line, theme)}
        </p>,
      );
    }

    index += 1;
  }

  return (
    <article className={cx("min-h-full overflow-auto p-5", t.mdSurface)}>
      <div className="mx-auto max-w-[860px]">{blocks}</div>
    </article>
  );
}

function CodeViewer({
  file,
  theme,
}: {
  file: CodebaseFile;
  theme: WorkspaceTheme;
}) {
  const language = languageForFile(file);
  const palette = syntaxPalettes[theme];
  const t = themeTokens[theme];
  const lines = file.content.split("\n");

  if (language === "markdown") {
    return <MarkdownPreview content={file.content} theme={theme} />;
  }

  return (
    <div className={cx("ch-mono flex min-h-full min-w-full w-max", t.canvas)}>
      <div
        className={cx(
          "select-none border-r px-2.5 py-3 text-right text-xs leading-6",
          t.codeLine,
        )}
      >
        {lines.map((_, index) => (
          <div className="h-6" key={index}>
            {index + 1}
          </div>
        ))}
      </div>
      <pre
        className="m-0 flex-1 py-3 pl-4 pr-8 text-xs leading-6"
        style={{ color: palette.base, tabSize: 2 }}
      >
        {lines.map((line, index) => (
          <div className="min-h-6 whitespace-pre" key={`${line}-${index}`}>
            {highlightCodeLine(line, language, palette)}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function AssessmentWorkspace({
  media,
  session,
}: {
  media: AssessmentMediaControls;
  session: CandidateAssessmentSession;
}) {
  const files = session.codeFiles;
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [theme, setTheme] = useState<WorkspaceTheme>("dark");
  const [activePath, setActivePath] = useState(files[0]?.path ?? "");
  const [openTabs, setOpenTabs] = useState<string[]>(() =>
    files[0]?.path ? [files[0].path] : [],
  );
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
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratch, setScratch] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(() => initialSeconds(session));
  const t = themeTokens[theme];
  const activeFile =
    files.find((file) => file.path === activePath) ??
    files.find((file) => file.path === openTabs[0]) ??
    null;
  const stack = session.technologies
    .map((technology) =>
      technology === "react_javascript" ? "React" : technology,
    )
    .join(" + ");

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 0 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  function toggleDir(path: string) {
    setOpenDirs((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function openFile(path: string) {
    setOpenTabs((previous) =>
      previous.includes(path) ? previous : [...previous, path],
    );
    setActivePath(path);
  }

  function closeFile(path: string) {
    const index = openTabs.indexOf(path);
    const next = openTabs.filter((tabPath) => tabPath !== path);
    setOpenTabs(next);

    if (activePath === path) {
      setActivePath(next[index] ?? next[index - 1] ?? "");
    }
  }

  function endSession() {
    if (typeof window === "undefined") {
      return;
    }

    const confirmed = window.confirm("End the assessment session?");
    if (!confirmed) {
      return;
    }

    media.stopMedia();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    window.location.reload();
  }

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      const indent = { paddingLeft: depth * 14 + 8 };

      if (node.isDir) {
        const open = openDirs.has(node.path);
        return (
          <div key={node.path}>
            <button
              className={cx(
                "group flex w-full items-center gap-1.5 rounded-[3px] px-2 py-1 text-left text-xs transition duration-150",
                t.muted,
                t.hover,
              )}
              onClick={() => toggleDir(node.path)}
              style={indent}
              type="button"
            >
              <ChevronDown
                className={cx(
                  "h-3.5 w-3.5 shrink-0 transition-transform",
                  t.faint,
                  !open && "-rotate-90",
                )}
              />
              <Folder className={cx("h-3.5 w-3.5 shrink-0", t.faint)} />
              <span className="truncate">{node.name}</span>
            </button>
            {open ? renderNodes(node.children, depth + 1) : null}
          </div>
        );
      }

      const active = node.path === activePath;
      return (
        <button
          className={cx(
            "relative flex w-full items-center gap-1.5 rounded-[3px] px-2 py-1 text-left text-xs transition duration-150",
            active
              ? `${t.active} before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-current before:content-['']`
              : `${t.muted} ${t.hover}`,
          )}
          key={node.path}
          onClick={() => openFile(node.path)}
          style={indent}
          type="button"
        >
          <span className="ch-mono w-6 shrink-0 text-center text-[10px] font-bold">
            {fileGlyph(node.name)}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

  return (
    <div
      className={cx(
        "ch-workspace fixed inset-0 flex flex-col overflow-hidden",
        t.root,
      )}
      data-theme={theme}
      style={
        {
          "--ch-scrollbar": t.scrollbar,
          "--ch-scrollbar-hover": t.scrollbarHover,
        } as CSSProperties
      }
    >
      <style>{workspaceCss}</style>

      <header
        className={cx(
          "flex min-h-[64px] shrink-0 items-center justify-between gap-3 border-b px-4 py-2",
          t.header,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0">
            <p className={cx("text-lg font-black leading-none", t.text)}>
              Chayote
            </p>
            <p className={cx("mt-1 text-[10px] font-bold uppercase", t.muted)}>
              {session.candidateName}
            </p>
          </div>
          <div className={cx("hidden h-7 w-px sm:block", t.line)} />
          <div className="hidden min-w-0 sm:block">
            <p className={cx("truncate text-[13px] font-bold", t.text)}>
              {session.title}
            </p>
            <p className={cx("mt-1 truncate text-[10px] uppercase", t.muted)}>
              {stack || "Assessment"} - {session.timeLimitMinutes} minutes
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className={cx("flex h-8 items-center gap-2 border px-2.5", t.panel)}>
            <Clock className={t.muted} size={14} />
            <span className="ch-mono text-xs font-bold">
              {formatClock(secondsLeft)}
            </span>
          </div>
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "light"}
            className={cx(
              "grid h-8 w-8 place-items-center rounded-[3px] border transition duration-150",
              t.button,
            )}
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            type="button"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-xs font-bold transition duration-150",
              t.danger,
            )}
            onClick={endSession}
            type="button"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">End session</span>
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={cx("hidden w-[248px] shrink-0 flex-col border-r md:flex", t.panel)}>
          <div className={cx("flex items-center justify-between border-b px-3 py-3 text-[11px] font-bold uppercase", t.line, t.muted)}>
            <span>Codebase</span>
            <Folder size={14} />
          </div>
          <div className="ch-mono flex-1 overflow-y-auto p-2">
            {files.length > 0 ? (
              renderNodes(tree, 0)
            ) : (
              <p className={cx("px-2 py-2 text-xs", t.faint)}>
                No files loaded.
              </p>
            )}
          </div>
        </aside>

        <section className={cx("flex min-w-0 flex-1 flex-col", t.canvas)}>
          <div className={cx("flex min-h-10 shrink-0 items-center justify-between gap-2 border-b px-2", t.header)}>
            <div className="flex min-w-0 flex-1 items-end overflow-x-auto pt-2">
              {openTabs.length > 0 ? (
                openTabs.map((path) => {
                  const active = path === activePath;
                  return (
                    <div
                      className={cx(
                        "mr-1 inline-flex h-8 max-w-[240px] shrink-0 items-center border border-b-2 text-xs transition duration-150",
                        active ? t.tabActive : t.tab,
                      )}
                      key={path}
                    >
                      <button
                        className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2.5"
                        onClick={() => setActivePath(path)}
                        type="button"
                      >
                        <span className="ch-mono text-[10px] font-bold">
                          {fileGlyph(path)}
                        </span>
                        <span className="truncate">{fileName(path)}</span>
                      </button>
                      <button
                        aria-label={`Close ${fileName(path)}`}
                        className={cx(
                          "mr-2 grid h-5 w-5 shrink-0 place-items-center rounded-[3px]",
                          active ? "hover:bg-white/15" : "hover:bg-black/10",
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          closeFile(path);
                        }}
                        type="button"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className={cx("px-2 text-sm", t.faint)}>Open a file.</p>
              )}
            </div>
            <button
              className={cx(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border px-2.5 text-[11px] font-bold uppercase transition duration-150",
                scratchOpen
                  ? theme === "dark"
                    ? "border-white bg-white text-[#111510]"
                    : "border-[#202322] bg-white text-[#202322]"
                  : t.button,
              )}
              onClick={() => setScratchOpen((value) => !value)}
              type="button"
            >
              <Code2 size={13} />
              <span className="hidden sm:inline">Scratchpad</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {activeFile ? (
              <CodeViewer file={activeFile} theme={theme} />
            ) : (
              <div className={cx("grid h-full place-items-center", t.canvasSoft)}>
                <div className="text-center">
                  <FileText className={cx("mx-auto", t.faint)} size={34} />
                  <p className={cx("mt-3 text-sm font-semibold", t.muted)}>
                    Select a file from the codebase.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {scratchOpen ? (
          <aside className={cx("hidden w-[300px] shrink-0 flex-col border-l lg:flex", t.panelSoft)}>
            <div className={cx("flex items-center justify-between border-b px-3 py-2.5 text-[11px] font-bold uppercase", t.line, t.muted)}>
              <span>Scratchpad</span>
              <button
                aria-label="Close scratchpad"
                className={cx("rounded-[3px] p-1 transition duration-150", t.hover)}
                onClick={() => setScratchOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              className={cx(
                "ch-mono flex-1 resize-none p-3 text-xs leading-6 outline-none",
                t.input,
              )}
              onChange={(event) => setScratch(event.target.value)}
              placeholder="Notes, edge cases, hypotheses..."
              value={scratch}
            />
          </aside>
        ) : null}
      </main>
    </div>
  );
}
