"use client";

import { useMemo, useState } from "react";
import { FileCode2, X } from "lucide-react";
import type { CodebaseFile } from "@/app/dashboard/data";

type CodebaseFilesModalProps = {
  files: CodebaseFile[];
  title?: string;
  triggerLabel?: string;
  variant?: "dark" | "light";
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CodebaseFilesModal({
  files,
  title = "Code files",
  triggerLabel = "Preview code files",
  variant = "light",
}: CodebaseFilesModalProps) {
  const [open, setOpen] = useState(false);
  const [activePath, setActivePath] = useState(files[0]?.path ?? "");

  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath) ?? files[0],
    [activePath, files],
  );

  return (
    <>
      <button
        className={cx(
          "inline-flex h-9 items-center justify-center gap-2 rounded-[3px] border px-3 text-[13px] font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-60",
          variant === "dark"
            ? "border-white/20 text-white hover:border-white/35 hover:bg-white/10"
            : "border-[#d8d5cf] text-[#202322] hover:border-[#c7c2ba] hover:bg-[#fbfaf7]",
        )}
        disabled={files.length === 0}
        onClick={() => {
          setActivePath(files[0]?.path ?? "");
          setOpen(true);
        }}
        type="button"
      >
        <FileCode2 size={16} />
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-5">
          <section
            aria-label={title}
            className="flex max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[8px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
          >
            <header className="flex items-center justify-between gap-4 border-b border-[#f0eeea] px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-[#62675e]">
                  {files.length} files
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#202322]">{title}</h2>
              </div>
              <button
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-[3px] text-[#4b5149] transition duration-150 hover:bg-[#efedea] hover:text-[#202322]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr]">
              <nav className="max-h-[32vh] overflow-y-auto border-b border-[#f0eeea] p-2 lg:max-h-none lg:border-b-0 lg:border-r">
                {files.map((file) => (
                  <button
                    className={
                      activeFile?.path === file.path
                        ? "flex min-h-9 w-full items-center justify-between gap-3 rounded-[3px] bg-[#ebe9e6] px-2 text-left text-[13px] font-semibold text-[#202322]"
                        : "flex min-h-9 w-full items-center justify-between gap-3 rounded-[3px] px-2 text-left text-[13px] font-medium text-[#4f544b] transition duration-150 hover:bg-[#efedea] hover:text-[#202322]"
                    }
                    key={file.path}
                    onClick={() => setActivePath(file.path)}
                    type="button"
                  >
                    <span className="truncate">{file.path}</span>
                    <span className="shrink-0 text-xs text-[#777c72]">
                      {file.lineCount}
                    </span>
                  </button>
                ))}
              </nav>

              <div className="min-h-0 overflow-hidden">
                {activeFile ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-[#f0eeea] px-4 py-2.5">
                      <p className="truncate text-[13px] font-semibold text-[#202322]">
                        {activeFile.path}
                      </p>
                      <p className="text-xs font-medium text-[#62675e]">
                        {activeFile.language}
                      </p>
                    </div>
                    <pre className="max-h-[62vh] overflow-auto bg-[#111510] p-4 text-[12px] leading-6 text-[#f8f8f2]">
                      <code>{activeFile.content}</code>
                    </pre>
                  </>
                ) : (
                  <p className="p-4 text-sm text-[#62675e]">
                    No code files are available.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
