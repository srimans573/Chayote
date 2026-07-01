"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy, Mail, RefreshCw, Trash2, Plus, Loader2, Send } from "lucide-react";
import type { AssessmentInvite } from "@/app/dashboard/data";
import {
  addCandidateInvite,
  sendInviteEmailAction,
  sendReminderEmailAction,
  deleteInvite,
  sendAllUnsent,
  remindAllStarted,
} from "@/app/dashboard/actions";

type Props = {
  assessmentId: string;
  invites: AssessmentInvite[];
};

type DisplayStatus = "unsent" | "invited" | "started" | "completed";

function getDisplayStatus(invite: AssessmentInvite): DisplayStatus {
  if (invite.status === "completed") return "completed";
  if (invite.status === "started") return "started";
  if (invite.emailSentAt) return "invited";
  return "unsent";
}

const STATUS_LABEL: Record<DisplayStatus, string> = {
  unsent: "Not sent",
  invited: "Invited",
  started: "In progress",
  completed: "Completed",
};

const STATUS_DOT: Record<DisplayStatus, string> = {
  unsent: "bg-[#d0cfc9]",
  invited: "bg-[#f5c842]",
  started: "bg-[#5b9cf0]",
  completed: "bg-[#7ec344]",
};

const STATUS_TEXT: Record<DisplayStatus, string> = {
  unsent: "text-[#62675e]",
  invited: "text-[#6b4e16]",
  started: "text-[#1a4a8c]",
  completed: "text-[#314200]",
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function IconBtn({
  onClick,
  title,
  loading,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cx(
        "grid h-7 w-7 shrink-0 place-items-center rounded-[3px] border border-[#dedbd5] transition",
        danger
          ? "text-[#62675e] hover:border-red-300 hover:text-red-700"
          : "text-[#62675e] hover:border-[#202322] hover:text-[#202322]",
        (disabled || loading) && "cursor-not-allowed opacity-40",
      )}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      type="button"
    >
      {loading ? <Loader2 className="animate-spin" size={12} /> : children}
    </button>
  );
}

export function InvitePanel({ assessmentId, invites: initial }: Props) {
  const [invites, setInvites] = useState<AssessmentInvite[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState<"email" | "remind" | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const unsentCount = invites.filter((inv) => !inv.emailSentAt).length;
  const remindableCount = invites.filter(
    (inv) => inv.emailSentAt && inv.status !== "completed",
  ).length;
  const completedCount = invites.filter((inv) => inv.status === "completed").length;

  function copyLink(inviteCode: string) {
    const url = `${window.location.origin}/assessment?code=${inviteCode}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(inviteCode);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set("assessmentId", assessmentId);
    fd.set("email", addEmail);
    fd.set("name", addName);
    startTransition(async () => {
      const result = await addCandidateInvite(fd);
      if (result.status === "error") {
        setAddError(result.message ?? "Failed to add.");
      } else if (result.invite) {
        setInvites((prev) => [result.invite!, ...prev]);
        setAddEmail("");
        setAddName("");
      }
    });
  }

  function handleSend(invite: AssessmentInvite) {
    setNotice(null);
    setLoadingId(invite.id);
    startTransition(async () => {
      const result = await sendInviteEmailAction(invite.id);
      setLoadingId(null);
      if (result.status === "error") {
        setNotice({ text: result.message ?? "Failed to send.", error: true });
      } else {
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === invite.id ? { ...inv, emailSentAt: new Date().toISOString() } : inv,
          ),
        );
      }
    });
  }

  function handleRemind(invite: AssessmentInvite) {
    setNotice(null);
    setLoadingId(invite.id);
    startTransition(async () => {
      const result = await sendReminderEmailAction(invite.id);
      setLoadingId(null);
      if (result.status === "error") {
        setNotice({ text: result.message ?? "Failed to send reminder.", error: true });
      } else {
        setInvites((prev) =>
          prev.map((inv) =>
            inv.id === invite.id ? { ...inv, reminderSentAt: new Date().toISOString() } : inv,
          ),
        );
        setNotice({ text: "Reminder sent." });
      }
    });
  }

  function handleDelete(invite: AssessmentInvite) {
    setNotice(null);
    setLoadingId(invite.id);
    startTransition(async () => {
      const result = await deleteInvite(invite.id);
      setLoadingId(null);
      if (result.status === "error") {
        setNotice({ text: result.message ?? "Failed to remove.", error: true });
      } else {
        setInvites((prev) => prev.filter((inv) => inv.id !== invite.id));
      }
    });
  }

  function handleEmailAll() {
    setNotice(null);
    setBulkLoading("email");
    startTransition(async () => {
      const result = await sendAllUnsent(assessmentId);
      setBulkLoading(null);
      if (result.status === "error") {
        setNotice({ text: result.message ?? "Failed.", error: true });
      } else {
        setInvites((prev) =>
          prev.map((inv) =>
            !inv.emailSentAt ? { ...inv, emailSentAt: new Date().toISOString() } : inv,
          ),
        );
        setNotice({
          text:
            result.failed > 0
              ? `Sent ${result.sent}, ${result.failed} failed.`
              : `Emailed ${result.sent} candidate${result.sent !== 1 ? "s" : ""}.`,
          error: result.failed > 0,
        });
      }
    });
  }

  function handleRemindAll() {
    setNotice(null);
    setBulkLoading("remind");
    startTransition(async () => {
      const result = await remindAllStarted(assessmentId);
      setBulkLoading(null);
      if (result.status === "error") {
        setNotice({ text: result.message ?? "Failed.", error: true });
      } else {
        setInvites((prev) =>
          prev.map((inv) =>
            inv.emailSentAt && inv.status !== "completed"
              ? { ...inv, reminderSentAt: new Date().toISOString() }
              : inv,
          ),
        );
        setNotice({
          text:
            result.failed > 0
              ? `Reminded ${result.sent}, ${result.failed} failed.`
              : `Reminded ${result.sent} candidate${result.sent !== 1 ? "s" : ""}.`,
          error: result.failed > 0,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header + stats */}
      <div>
        <p className="text-xs font-semibold text-[#62675e]">Candidates</p>
        {invites.length > 0 && (
          <p className="mt-1 text-xs text-[#9aa093]">
            {[
              unsentCount > 0 && `${unsentCount} unsent`,
              remindableCount > 0 && `${remindableCount} awaiting`,
              completedCount > 0 && `${completedCount} done`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {/* Global actions */}
      {invites.length > 0 && (unsentCount > 0 || remindableCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {unsentCount > 0 && (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-[#202322] px-3 text-xs font-semibold text-white transition hover:bg-[#3a3f37] disabled:opacity-50"
              disabled={isPending}
              onClick={handleEmailAll}
              type="button"
            >
              {bulkLoading === "email" ? (
                <Loader2 className="animate-spin" size={12} />
              ) : (
                <Send size={12} />
              )}
              Email {unsentCount} uninvited
            </button>
          )}
          {remindableCount > 0 && (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-[#dedbd5] px-3 text-xs font-semibold text-[#202322] transition hover:bg-[#f4f3f1] disabled:opacity-50"
              disabled={isPending}
              onClick={handleRemindAll}
              type="button"
            >
              {bulkLoading === "remind" ? (
                <Loader2 className="animate-spin" size={12} />
              ) : (
                <RefreshCw size={12} />
              )}
              Remind {remindableCount}
            </button>
          )}
        </div>
      )}

      {notice && (
        <p className={cx("text-xs", notice.error ? "text-red-700" : "text-[#4f554d]")}>
          {notice.text}
        </p>
      )}

      {/* Add form */}
      <form className="flex flex-col gap-2" onSubmit={handleAdd}>
        <div className="flex gap-2">
          <input
            className="h-9 min-w-0 flex-1 rounded-[3px] border border-[#dedbd5] bg-white px-3 text-sm outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="Email address"
            required
            type="email"
            value={addEmail}
          />
          <button
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] border border-[#dedbd5] px-3 text-sm font-semibold text-[#202322] transition hover:bg-[#f4f3f1] disabled:opacity-50"
            disabled={isPending}
            type="submit"
          >
            {isPending && !loadingId && !bulkLoading ? (
              <Loader2 className="animate-spin" size={13} />
            ) : (
              <Plus size={13} />
            )}
            Add
          </button>
        </div>
        <input
          className="h-8 rounded-[3px] border border-[#dedbd5] bg-white px-3 text-sm outline-none focus:border-[#202322] focus:ring-2 focus:ring-[#d7ff5a]"
          onChange={(e) => setAddName(e.target.value)}
          placeholder="Name (optional)"
          type="text"
          value={addName}
        />
        {addError && <p className="text-xs text-red-700">{addError}</p>}
      </form>

      {/* Candidate list */}
      {invites.length === 0 ? (
        <p className="text-sm text-[#9aa093]">No candidates yet.</p>
      ) : (
        <div className="divide-y divide-[#f0eeea]">
          {invites.map((invite) => {
            const display = getDisplayStatus(invite);
            const isLoading = loadingId === invite.id;
            const canRemind = display === "invited" || display === "started";
            const canDelete = display === "unsent" || display === "invited";

            return (
              <div className="flex items-center gap-2 py-3" key={invite.id}>
                <div className="min-w-0 flex-1">
                  {invite.candidateId ? (
                    <Link
                      className="truncate text-sm font-medium text-[#202322] hover:underline"
                      href={`/dashboard/candidates/${invite.candidateId}`}
                    >
                      {invite.name ?? invite.email}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium text-[#202322]">
                      {invite.name ?? invite.email}
                    </p>
                  )}
                  {invite.candidateId && invite.name && (
                    <p className="truncate text-xs text-[#62675e]">{invite.email}</p>
                  )}
                  {!invite.candidateId && invite.name && (
                    <p className="truncate text-xs text-[#62675e]">{invite.name}</p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cx("inline-block h-1.5 w-1.5 rounded-full", STATUS_DOT[display])} />
                    <span className={cx("text-xs", STATUS_TEXT[display])}>
                      {STATUS_LABEL[display]}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <IconBtn onClick={() => copyLink(invite.inviteCode)} title="Copy invite link">
                    {copiedCode === invite.inviteCode ? <Check size={12} /> : <Copy size={12} />}
                  </IconBtn>

                  {display === "unsent" && (
                    <IconBtn
                      disabled={isPending}
                      loading={isLoading}
                      onClick={() => handleSend(invite)}
                      title="Send invite email"
                    >
                      <Mail size={12} />
                    </IconBtn>
                  )}

                  {canRemind && (
                    <IconBtn
                      disabled={isPending}
                      loading={isLoading}
                      onClick={() => handleRemind(invite)}
                      title={invite.reminderSentAt ? "Send another reminder" : "Send reminder"}
                    >
                      <RefreshCw size={12} />
                    </IconBtn>
                  )}

                  {canDelete && (
                    <IconBtn
                      danger
                      disabled={isPending}
                      loading={isLoading}
                      onClick={() => handleDelete(invite)}
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </IconBtn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
