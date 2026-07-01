"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assessmentTechnologyLabels,
  formatInvite,
  type AssessmentInvite,
  type AssessmentTechnology,
  type RubricSource,
} from "@/app/dashboard/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { extractRubricTopics, generateCodebase } from "@/lib/voiceAgent";
import {
  sendInviteEmail as _sendInviteEmail,
  sendReminderEmail as _sendReminderEmail,
} from "@/lib/email";

type AssessmentField =
  | "expirationDate"
  | "jobDescription"
  | "rubricFile"
  | "rubricSource"
  | "technologies"
  | "timeLimitMinutes"
  | "title";

export type CreateAssessmentFormState = {
  fieldErrors?: Partial<Record<AssessmentField, string>>;
  message?: string;
  status: "idle" | "error";
};

const assessmentTechnologies: AssessmentTechnology[] = [
  "react_javascript",
  "python",
];
const rubricSources: RubricSource[] = ["generated", "uploaded"];

function readFormString(formData: FormData, key: AssessmentField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseExpirationDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const expirationDate = new Date(`${value}T23:59:59.999Z`);

  if (Number.isNaN(expirationDate.getTime())) {
    return undefined;
  }

  return expirationDate;
}

function isAssessmentTechnology(value: string): value is AssessmentTechnology {
  return assessmentTechnologies.includes(value as AssessmentTechnology);
}

function isRubricSource(value: string): value is RubricSource {
  return rubricSources.includes(value as RubricSource);
}

async function readUploadedRubric(formData: FormData) {
  const rubricFile = formData.get("rubricFile");

  if (!(rubricFile instanceof File) || rubricFile.size === 0) {
    return {
      error: "Upload a rubric file.",
      text: "",
    };
  }

  return {
    error: undefined,
    text: await rubricFile.text(),
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/auth");
}

export async function createAssessment(
  _previousState: CreateAssessmentFormState,
  formData: FormData,
): Promise<CreateAssessmentFormState> {
  const title = readFormString(formData, "title");
  const expirationDateValue = readFormString(formData, "expirationDate");
  const jobDescription = readFormString(formData, "jobDescription");
  const timeLimitValue = readFormString(formData, "timeLimitMinutes");
  const rubricSourceValue = readFormString(formData, "rubricSource");
  const hmSpecValue = formData.get("codbbaseSpec");
  const hmSpec = typeof hmSpecValue === "string" ? hmSpecValue.trim() : "";
  const timeLimitMinutes = Number(timeLimitValue);
  const expirationDate = parseExpirationDate(expirationDateValue);
  const selectedTechnologies = Array.from(
    new Set(
      formData
        .getAll("technologies")
        .filter((technology): technology is string => typeof technology === "string")
        .filter(isAssessmentTechnology),
    ),
  );
  const fieldErrors: CreateAssessmentFormState["fieldErrors"] = {};

  if (title.length < 2) {
    fieldErrors.title = "Enter an assessment title.";
  }

  if (!expirationDate || expirationDate.getTime() < Date.now()) {
    fieldErrors.expirationDate = "Choose a future expiration date.";
  }

  if (
    !Number.isInteger(timeLimitMinutes) ||
    timeLimitMinutes < 20 ||
    timeLimitMinutes > 60
  ) {
    fieldErrors.timeLimitMinutes = "Use a time limit from 20 to 60 minutes.";
  }

  if (selectedTechnologies.length === 0) {
    fieldErrors.technologies = "Choose at least one technology.";
  }

  if (jobDescription.length < 10) {
    fieldErrors.jobDescription = "Enter a job description.";
  }

  if (!isRubricSource(rubricSourceValue)) {
    fieldErrors.rubricSource = "Choose a rubric option.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  if (
    selectedTechnologies.length === 0 ||
    !expirationDate ||
    !isRubricSource(rubricSourceValue)
  ) {
    return {
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError || !userResult.user) {
    return {
      message: "Sign in to create assessments.",
      status: "error",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("recruiter_profiles")
    .select("organization_id,status")
    .eq("id", userResult.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    return {
      message: "Active recruiter access is required.",
      status: "error",
    };
  }

  // --- Codebase: generate per-assessment or fall back to shared template ---

  let codbbaseTemplateId: string | null = null;
  let codbbaseSource: "generated" | "template" = "template";
  let codbbaseSpec: Json | null = null;
  let seamTopics: string[] = [];

  try {
    const generated = await generateCodebase({
      jdText: jobDescription,
      hmSpec,
      technologies: selectedTechnologies,
    });

    // Generate the UUID here so we don't need to SELECT the inserted row back —
    // the templates SELECT policy only covers is_active=true rows, so
    // .insert().select().single() would return null even on a successful INSERT.
    const { randomUUID } = await import("crypto");
    const newTemplateId = randomUUID();
    const slug = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const { error: templateInsertError } = await supabase
      .from("assessment_codebase_templates")
      .insert({
        id: newTemplateId,
        slug,
        title: String(generated.merged_spec.app_name ?? title),
        description: String(generated.merged_spec.app_description ?? ""),
        frontend_technology: "react_javascript",
        backend_technology: "python",
        technologies: selectedTechnologies,
        is_active: false,
      });

    if (templateInsertError) {
      console.error("[createAssessment] template insert failed:", templateInsertError.message, templateInsertError.code);
    } else {
      const fileRows = generated.files.map((f, i) => ({
        codebase_template_id: newTemplateId,
        path: f.path,
        language: f.language,
        content: f.content,
        sort_order: i,
      }));

      const { error: filesInsertError } = await supabase.from("assessment_codebase_files").insert(fileRows);
      if (filesInsertError) {
        console.error("[createAssessment] files insert failed:", filesInsertError.message, filesInsertError.code);
      }

      codbbaseTemplateId = newTemplateId;
      codbbaseSource = "generated";
      codbbaseSpec = generated.merged_spec as unknown as Json;
      seamTopics = generated.seam_topics;
    }
  } catch (err) {
    console.error("[createAssessment] generation pipeline failed:", err instanceof Error ? err.message : String(err));
  }

  if (codbbaseSource === "template") {
    const { data: fallbackTemplate, error: templateError } = await supabase
      .from("assessment_codebase_templates")
      .select("id")
      .eq("slug", "employee-directory-dashboard")
      .eq("is_active", true)
      .maybeSingle();

    if (templateError || !fallbackTemplate) {
      return {
        message: "No codebase template is available.",
        status: "error",
      };
    }

    codbbaseTemplateId = fallbackTemplate.id;
  }

  // --- Rubric ---

  let rubricText = "";

  if (rubricSourceValue === "uploaded") {
    const uploadedRubric = await readUploadedRubric(formData);

    if (uploadedRubric.error) {
      return {
        fieldErrors: {
          rubricFile: uploadedRubric.error,
        },
        message: "Check the highlighted fields.",
        status: "error",
      };
    }

    rubricText = uploadedRubric.text;
  } else if (codbbaseSource === "generated" && codbbaseSpec) {
    // Synthesize rubric text from the seams embedded in the generated codebase spec.
    // Each seam maps to one scorable topic the interviewer should probe.
    const spec = codbbaseSpec as Record<string, unknown>;
    const seams = Array.isArray(spec.seams) ? (spec.seams as Record<string, unknown>[]) : [];
    const appName = String(spec.app_name ?? title);
    const appDescription = spec.app_description ? String(spec.app_description) : "";
    rubricText = [
      `# ${appName} — Interview Rubric`,
      "",
      ...(appDescription ? [appDescription, ""] : []),
      "## Topics to Evaluate",
      "",
      ...seams.map((s) => `- **${String(s.rubric_topic ?? "")}**: ${String(s.description ?? "")}`),
    ].join("\n");
  } else {
    // Shared template — look up pre-written rubric from DB
    const { data: rubricTemplate, error: rubricError } = await supabase
      .from("assessment_rubric_templates")
      .select("content")
      .eq("codebase_template_id", codbbaseTemplateId ?? "")
      .maybeSingle();

    rubricText = rubricError || !rubricTemplate ? "" : rubricTemplate.content;
  }

  const technologyLabel = selectedTechnologies
    .map((technology) => assessmentTechnologyLabels[technology])
    .join(" + ");

  let rubricTopics: string[] = [];
  try {
    if (rubricText) {
      rubricTopics = (await extractRubricTopics(rubricText)).topics;
    }
  } catch {
    rubricTopics = [];
  }

  // Merge seam topics (from generated codebase) with rubric-derived topics —
  // seam topics take precedence since they map directly to the injected issues.
  if (seamTopics.length > 0) {
    const allTopics = [...seamTopics];
    for (const t of rubricTopics) {
      if (!allTopics.includes(t)) allTopics.push(t);
    }
    rubricTopics = allTopics;
  }

  const { data: insertedAssessment, error: insertError } = await supabase
    .from("assessments")
    .insert({
      codebase_template_id: codbbaseTemplateId,
      codebase_source: codbbaseSource,
      codebase_spec: codbbaseSpec,
      hm_spec: hmSpec || null,
      created_by: userResult.user.id,
      due_at: expirationDate.toISOString(),
      job_description: jobDescription,
      organization_id: profile.organization_id,
      role_name: technologyLabel,
      rubric_source: rubricSourceValue,
      rubric_text: rubricText,
      rubric_topics: rubricTopics,
      status: "draft",
      technologies: selectedTechnologies,
      time_limit_minutes: timeLimitMinutes,
      title,
    })
    .select("id")
    .single();

  if (insertError || !insertedAssessment) {
    return {
      message: insertError?.message ?? "Assessment was not created.",
      status: "error",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/assessments");
  redirect(`/dashboard/assessments/${insertedAssessment.id}?created=1`);
}

type UpdateAssessmentField =
  | "expirationDate"
  | "jobDescription"
  | "rubricText"
  | "technologies"
  | "timeLimitMinutes"
  | "title";

export type UpdateAssessmentFormState = {
  fieldErrors?: Partial<Record<UpdateAssessmentField, string>>;
  message?: string;
  status: "idle" | "error" | "success";
};

function readUpdateFormString(formData: FormData, key: UpdateAssessmentField) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateAssessment(
  _previousState: UpdateAssessmentFormState,
  formData: FormData,
): Promise<UpdateAssessmentFormState> {
  const assessmentIdValue = formData.get("assessmentId");
  const assessmentId =
    typeof assessmentIdValue === "string" ? assessmentIdValue.trim() : "";
  const title = readUpdateFormString(formData, "title");
  const jobDescription = readUpdateFormString(formData, "jobDescription");
  const rubricText = readUpdateFormString(formData, "rubricText");
  const expirationDateValue = readUpdateFormString(formData, "expirationDate");
  const timeLimitValue = readUpdateFormString(formData, "timeLimitMinutes");
  const timeLimitMinutes = Number(timeLimitValue);
  const expirationDate = parseExpirationDate(expirationDateValue);
  const selectedTechnologies = Array.from(
    new Set(
      formData
        .getAll("technologies")
        .filter((technology): technology is string => typeof technology === "string")
        .filter(isAssessmentTechnology),
    ),
  );
  const fieldErrors: UpdateAssessmentFormState["fieldErrors"] = {};

  if (!assessmentId) {
    return { message: "Missing assessment.", status: "error" };
  }

  if (title.length < 2) {
    fieldErrors.title = "Enter an assessment title.";
  }

  if (jobDescription.length < 10) {
    fieldErrors.jobDescription = "Enter a job description.";
  }

  if (!expirationDate || expirationDate.getTime() < Date.now()) {
    fieldErrors.expirationDate = "Choose a future expiration date.";
  }

  if (
    !Number.isInteger(timeLimitMinutes) ||
    timeLimitMinutes < 20 ||
    timeLimitMinutes > 60
  ) {
    fieldErrors.timeLimitMinutes = "Use a time limit from 20 to 60 minutes.";
  }

  if (selectedTechnologies.length === 0) {
    fieldErrors.technologies = "Choose at least one technology.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  if (!expirationDate) {
    return {
      message: "Check the highlighted fields.",
      status: "error",
    };
  }

  if (!hasSupabaseConfig()) {
    return {
      message: "The database is not configured yet.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError || !userResult.user) {
    return {
      message: "Sign in to edit assessments.",
      status: "error",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("recruiter_profiles")
    .select("organization_id,status")
    .eq("id", userResult.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    return {
      message: "Active recruiter access is required.",
      status: "error",
    };
  }

  const { data: existingAssessment, error: existingError } = await supabase
    .from("assessments")
    .select("rubric_text")
    .eq("id", assessmentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (existingError || !existingAssessment) {
    return {
      message: "Assessment not found.",
      status: "error",
    };
  }

  let rubricTopics: string[] | undefined;
  if (rubricText !== existingAssessment.rubric_text) {
    try {
      rubricTopics = (await extractRubricTopics(rubricText)).topics;
    } catch {
      // Categorization failed — leave the existing topic list in place
      // rather than blocking the rest of the edit.
      rubricTopics = undefined;
    }
  }

  const { error: updateError } = await supabase
    .from("assessments")
    .update({
      due_at: expirationDate.toISOString(),
      job_description: jobDescription,
      rubric_text: rubricText,
      technologies: selectedTechnologies,
      time_limit_minutes: timeLimitMinutes,
      title,
      ...(rubricTopics ? { rubric_topics: rubricTopics } : {}),
    })
    .eq("id", assessmentId)
    .eq("organization_id", profile.organization_id);

  if (updateError) {
    return {
      message: updateError.message,
      status: "error",
    };
  }

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  revalidatePath("/dashboard/assessments");
  revalidatePath("/dashboard");

  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Invite management
// ---------------------------------------------------------------------------

export type InviteActionState = {
  message?: string;
  status: "idle" | "error" | "success";
  invite?: AssessmentInvite;
};

async function getActiveProfile() {
  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) return { error: "Sign in to manage invites.", supabase, profile: null };

  const { data: profile } = await supabase
    .from("recruiter_profiles")
    .select("organization_id,status")
    .eq("id", userResult.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return { error: "Active recruiter access required.", supabase, profile: null };
  }

  return { error: undefined, supabase, profile };
}

export async function addCandidateInvite(
  formData: FormData,
): Promise<InviteActionState> {
  const assessmentId =
    typeof formData.get("assessmentId") === "string"
      ? (formData.get("assessmentId") as string).trim()
      : "";
  const email =
    typeof formData.get("email") === "string"
      ? (formData.get("email") as string).trim().toLowerCase()
      : "";
  const name =
    typeof formData.get("name") === "string"
      ? (formData.get("name") as string).trim()
      : "";

  if (!assessmentId) return { status: "error", message: "Missing assessment." };
  if (!email.includes("@")) return { status: "error", message: "Enter a valid email address." };

  const { error: profileError, supabase, profile } = await getActiveProfile();
  if (profileError || !profile) return { status: "error", message: profileError };

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("id", assessmentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!assessment) return { status: "error", message: "Assessment not found." };

  const { data: invite, error: insertError } = await supabase
    .from("assessment_invites")
    .insert({
      assessment_id: assessmentId,
      email,
      name: name || null,
    })
    .select()
    .single();

  if (insertError || !invite) {
    return {
      status: "error",
      message: insertError?.message ?? "Failed to add invite.",
    };
  }

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  return { status: "success", invite: formatInvite(invite) };
}

export async function sendInviteEmailAction(
  inviteId: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const { error: profileError, supabase, profile } = await getActiveProfile();
  if (profileError || !profile) return { status: "error", message: profileError };

  const { data: invite } = await supabase
    .from("assessment_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return { status: "error", message: "Invite not found." };

  const { data: assessment } = await supabase
    .from("assessments")
    .select("title,time_limit_minutes,due_at,organization_id")
    .eq("id", invite.assessment_id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!assessment) return { status: "error", message: "Invite not found." };

  try {
    await _sendInviteEmail({
      to: invite.email,
      name: invite.name,
      inviteCode: invite.invite_code,
      assessmentTitle: assessment.title,
      timeLimitMinutes: assessment.time_limit_minutes,
      dueAt: assessment.due_at,
    });
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to send email.",
    };
  }

  await supabase
    .from("assessment_invites")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", inviteId);

  revalidatePath(`/dashboard/assessments/${invite.assessment_id}`);
  return { status: "success" };
}

export async function sendReminderEmailAction(
  inviteId: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const { error: profileError, supabase, profile } = await getActiveProfile();
  if (profileError || !profile) return { status: "error", message: profileError };

  const { data: invite } = await supabase
    .from("assessment_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return { status: "error", message: "Invite not found." };

  const { data: assessment } = await supabase
    .from("assessments")
    .select("title,time_limit_minutes,due_at,organization_id")
    .eq("id", invite.assessment_id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!assessment) return { status: "error", message: "Invite not found." };

  try {
    await _sendReminderEmail({
      to: invite.email,
      name: invite.name,
      inviteCode: invite.invite_code,
      assessmentTitle: assessment.title,
      timeLimitMinutes: assessment.time_limit_minutes,
      dueAt: assessment.due_at,
    });
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to send reminder.",
    };
  }

  await supabase
    .from("assessment_invites")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", inviteId);

  revalidatePath(`/dashboard/assessments/${invite.assessment_id}`);
  return { status: "success" };
}

export async function sendAllUnsent(
  assessmentId: string,
): Promise<{ status: "success" | "error"; sent: number; failed: number; message?: string }> {
  const { error: profileError, supabase, profile } = await getActiveProfile();
  if (profileError || !profile) return { status: "error", sent: 0, failed: 0, message: profileError };

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id,title,time_limit_minutes,due_at")
    .eq("id", assessmentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!assessment) return { status: "error", sent: 0, failed: 0, message: "Assessment not found." };

  const { data: invites } = await supabase
    .from("assessment_invites")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("status", "pending")
    .is("email_sent_at", null);

  let sent = 0;
  let failed = 0;

  for (const invite of invites ?? []) {
    try {
      await _sendInviteEmail({
        to: invite.email,
        name: invite.name,
        inviteCode: invite.invite_code,
        assessmentTitle: assessment.title,
        timeLimitMinutes: assessment.time_limit_minutes,
        dueAt: assessment.due_at,
      });
      await supabase
        .from("assessment_invites")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", invite.id);
      sent++;
    } catch {
      failed++;
    }
  }

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  return { status: "success", sent, failed };
}

export async function remindAllStarted(
  assessmentId: string,
): Promise<{ status: "success" | "error"; sent: number; failed: number; message?: string }> {
  const { error: profileError, supabase, profile } = await getActiveProfile();
  if (profileError || !profile) return { status: "error", sent: 0, failed: 0, message: profileError };

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id,title,time_limit_minutes,due_at")
    .eq("id", assessmentId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!assessment) return { status: "error", sent: 0, failed: 0, message: "Assessment not found." };

  const { data: invites } = await supabase
    .from("assessment_invites")
    .select("*")
    .eq("assessment_id", assessmentId)
    .not("email_sent_at", "is", null)
    .neq("status", "completed");

  let sent = 0;
  let failed = 0;

  for (const invite of invites ?? []) {
    try {
      await _sendReminderEmail({
        to: invite.email,
        name: invite.name,
        inviteCode: invite.invite_code,
        assessmentTitle: assessment.title,
        timeLimitMinutes: assessment.time_limit_minutes,
        dueAt: assessment.due_at,
      });
      await supabase
        .from("assessment_invites")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", invite.id);
      sent++;
    } catch {
      failed++;
    }
  }

  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  return { status: "success", sent, failed };
}

export async function deleteInvite(
  inviteId: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const { error: profileError, supabase, profile } = await getActiveProfile();
  if (profileError || !profile) return { status: "error", message: profileError };

  const { data: invite } = await supabase
    .from("assessment_invites")
    .select("status,assessment_id")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return { status: "error", message: "Invite not found." };

  if (invite.status !== "pending") {
    return {
      status: "error",
      message: "Cannot remove an invite that has already been used.",
    };
  }

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id")
    .eq("id", invite.assessment_id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  if (!assessment) return { status: "error", message: "Invite not found." };

  const { error: deleteError } = await supabase
    .from("assessment_invites")
    .delete()
    .eq("id", inviteId);

  if (deleteError) return { status: "error", message: deleteError.message };

  revalidatePath(`/dashboard/assessments/${invite.assessment_id}`);
  return { status: "success" };
}
