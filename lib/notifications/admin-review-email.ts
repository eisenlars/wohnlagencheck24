type SendAdminReviewReadyEmailArgs = {
  areaId: string;
  areaName?: string | null;
  partnerId: string;
  partnerName?: string | null;
  submittedAtIso?: string | null;
  recipients?: string[] | null;
};

type SendPartnerReviewSubmittedEmailArgs = {
  partnerEmail: string;
  partnerName?: string | null;
  areaId: string;
  areaName?: string | null;
  submittedAtIso?: string | null;
};

type SendPartnerAreaApprovedEmailArgs = {
  partnerEmail: string;
  partnerName?: string | null;
  areaId: string;
  areaName?: string | null;
  approvedAtIso?: string | null;
};

type SendAdminPartnerOnboardedEmailArgs = {
  partnerId: string;
  partnerName?: string | null;
  partnerEmail?: string | null;
  loggedInAtIso?: string | null;
  recipients?: string[] | null;
};

type SendPartnerAreaAssignedEmailArgs = {
  partnerEmail: string;
  partnerName?: string | null;
  areaId: string;
  areaName?: string | null;
  assignedAtIso?: string | null;
};

type SendAdminInviteResendRequestEmailArgs = {
  email: string;
  audience?: "partner" | "admin";
  requestedAtIso?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  partnerIsActive?: boolean | null;
  recipients?: string[] | null;
};

type SendPartnerPasswordResetEmailArgs = {
  partnerEmail: string;
  partnerName?: string | null;
  resetLink: string;
};

type SendPartnerInviteEmailArgs = {
  partnerEmail: string;
  partnerName?: string | null;
  companyName?: string | null;
  inviteLink: string;
};

function parseCsv(value: string): string[] {
  return String(value ?? "")
    .split(/[,\n;]+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function parseBoolean(value: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return (
    normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on"
    || normalized === "ssl"
    || normalized === "tls"
  );
}

function buildSubject(args: SendAdminReviewReadyEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  return `Freigabeprüfung angefordert: ${area}`;
}

function buildText(args: SendAdminReviewReadyEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  const partner = String(args.partnerName ?? args.partnerId).trim();
  const submittedAt = args.submittedAtIso
    ? new Date(args.submittedAtIso).toLocaleString("de-DE")
    : new Date().toLocaleString("de-DE");

  return [
    "Ein Partnergebiet wurde zur Freigabeprüfung eingereicht.",
    "",
    `Gebiet: ${area}`,
    `Area ID: ${args.areaId}`,
    `Partner: ${partner}`,
    `Partner ID: ${args.partnerId}`,
    `Eingereicht am: ${submittedAt}`,
    "",
    "Bitte im Adminbereich den Prüfprozess starten und den Status auf 'in_review' setzen.",
  ].join("\n");
}

function buildPartnerSubject(args: SendPartnerReviewSubmittedEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  return `Freigabe angefordert: ${area}`;
}

function pickGreetingName(rawName: string): string {
  const normalized = String(rawName ?? "").trim();
  if (!normalized) return "";
  return normalized.split(/\s+/)[0] ?? "";
}

function buildPartnerText(args: SendPartnerReviewSubmittedEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  const partner = pickGreetingName(String(args.partnerName ?? ""));
  const submittedAt = args.submittedAtIso
    ? new Date(args.submittedAtIso).toLocaleString("de-DE")
    : new Date().toLocaleString("de-DE");
  return [
    `Hallo${partner ? ` ${partner}` : ""},`,
    "",
    "deine Freigabeanforderung wurde erfolgreich übermittelt.",
    "",
    `Gebiet: ${area}`,
    `Area ID: ${args.areaId}`,
    `Zeitpunkt: ${submittedAt}`,
    "",
    "Deine Angaben liegen jetzt beim Admin zur Prüfung vor.",
    "Sobald die Prüfung abgeschlossen ist, wird dein Gebiet freigeschaltet.",
  ].join("\n");
}

function buildPartnerApprovedSubject(args: SendPartnerAreaApprovedEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  return `Gebiet freigegeben: ${area}`;
}

function buildPartnerApprovedText(args: SendPartnerAreaApprovedEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  const partner = pickGreetingName(String(args.partnerName ?? ""));
  const approvedAt = args.approvedAtIso
    ? new Date(args.approvedAtIso).toLocaleString("de-DE")
    : new Date().toLocaleString("de-DE");
  return [
    `Hallo${partner ? ` ${partner}` : ""},`,
    "",
    "dein Gebiet wurde erfolgreich freigegeben.",
    "",
    `Gebiet: ${area}`,
    `Area ID: ${args.areaId}`,
    `Freigegeben am: ${approvedAt}`,
    "",
    "Du kannst jetzt den Partnerbereich nutzen.",
  ].join("\n");
}

function buildAdminPartnerOnboardedSubject(args: SendAdminPartnerOnboardedEmailArgs): string {
  const partner = String(args.partnerName ?? args.partnerId).trim();
  return `Partner angemeldet: ${partner}`;
}

function buildAdminPartnerOnboardedText(args: SendAdminPartnerOnboardedEmailArgs): string {
  const partner = String(args.partnerName ?? args.partnerId).trim();
  const partnerEmail = String(args.partnerEmail ?? "").trim();
  const loggedInAt = args.loggedInAtIso
    ? new Date(args.loggedInAtIso).toLocaleString("de-DE")
    : new Date().toLocaleString("de-DE");

  return [
    "Ein neuer Partner hat sich erfolgreich im Partnerbereich angemeldet.",
    "",
    `Partner: ${partner}`,
    `Partner ID: ${args.partnerId}`,
    `E-Mail: ${partnerEmail || "nicht hinterlegt"}`,
    `Zeitpunkt: ${loggedInAt}`,
    "",
    "Bitte im Adminbereich Gebiete zuweisen.",
  ].join("\n");
}

function buildPartnerAssignedSubject(args: SendPartnerAreaAssignedEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  return `Neues Gebiet zugewiesen: ${area}`;
}

function buildPartnerAssignedText(args: SendPartnerAreaAssignedEmailArgs): string {
  const area = String(args.areaName ?? args.areaId).trim();
  const partner = pickGreetingName(String(args.partnerName ?? ""));
  const assignedAt = args.assignedAtIso
    ? new Date(args.assignedAtIso).toLocaleString("de-DE")
    : new Date().toLocaleString("de-DE");
  return [
    `Hallo${partner ? ` ${partner}` : ""},`,
    "",
    "dir wurde ein neues Gebiet zugewiesen.",
    "",
    `Gebiet: ${area}`,
    `Area ID: ${args.areaId}`,
    `Zugewiesen am: ${assignedAt}`,
    "",
    "Bitte ergänze jetzt deine Pflichtangaben und fordere danach die Freigabe an.",
  ].join("\n");
}

function buildAdminInviteResendRequestSubject(args: SendAdminInviteResendRequestEmailArgs): string {
  const aud = args.audience === "admin" ? "Admin" : "Partner";
  return `Link-Anfrage (${aud}): ${args.email}`;
}

function buildAdminInviteResendRequestText(args: SendAdminInviteResendRequestEmailArgs): string {
  const requestedAt = args.requestedAtIso
    ? new Date(args.requestedAtIso).toLocaleString("de-DE")
    : new Date().toLocaleString("de-DE");
  const aud = args.audience === "admin" ? "admin" : "partner";
  const partnerId = String(args.partnerId ?? "").trim();
  const partnerName = String(args.partnerName ?? "").trim();
  const partnerIsActive = typeof args.partnerIsActive === "boolean"
    ? (args.partnerIsActive ? "ja" : "nein")
    : "unbekannt";

  return [
    "Es wurde ein neuer Zugangslink angefordert.",
    "",
    `Bereich: ${aud}`,
    `E-Mail: ${args.email}`,
    `Partner: ${partnerName || "nicht gefunden"}`,
    `Partner ID: ${partnerId || "nicht gefunden"}`,
    `Partner bereits aktiviert: ${partnerIsActive}`,
    `Zeitpunkt: ${requestedAt}`,
    "",
    "Bitte im Adminbereich den Einladungslink erneut versenden.",
  ].join("\n");
}

function buildPartnerPasswordResetSubject(): string {
  return "Passwort neu setzen";
}

function buildPartnerPasswordResetText(args: SendPartnerPasswordResetEmailArgs): string {
  const partner = pickGreetingName(String(args.partnerName ?? ""));
  return [
    `Hallo${partner ? ` ${partner}` : ""},`,
    "",
    "du hast angefordert, dein Passwort fuer den Partnerbereich neu zu setzen.",
    "",
    "Bitte oeffne den folgenden Link, um ein neues Passwort zu vergeben:",
    args.resetLink,
    "",
    "Der Link ist zeitlich begrenzt und kann nur einmal verwendet werden.",
    "Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.",
  ].join("\n");
}

function buildPartnerInviteSubject(args: SendPartnerInviteEmailArgs): string {
  const companyName = String(args.companyName ?? "").trim();
  return companyName ? `Partnerkonto aktivieren: ${companyName}` : "Partnerkonto aktivieren";
}

function buildPartnerInviteText(args: SendPartnerInviteEmailArgs): string {
  const partner = pickGreetingName(String(args.partnerName ?? ""));
  const companyName = String(args.companyName ?? "").trim();
  return [
    `Hallo${partner ? ` ${partner}` : ""},`,
    "",
    companyName
      ? `fuer ${companyName} wurde ein neues Partnerkonto angelegt oder erneut aktiviert.`
      : "fuer dich wurde ein neues Partnerkonto angelegt oder erneut aktiviert.",
    "",
    "Bitte oeffne den folgenden Link, um dein Partnerkonto zu aktivieren und ein Passwort zu vergeben:",
    args.inviteLink,
    "",
    "Der Link ist zeitlich begrenzt und kann nur einmal verwendet werden.",
    "Falls du keine Einladung erwartest, kannst du diese E-Mail ignorieren.",
  ].join("\n");
}

async function sendSmtpTextMail(params: {
  to: string[];
  subject: string;
  text: string;
  from?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const simulate = String(process.env.ADMIN_REVIEW_NOTIFY_SIMULATE ?? "").trim() === "1";
  if (simulate) {
    return { sent: true, reason: "simulated" };
  }

  const smtpHost = String(process.env.SMTP_HOST ?? process.env.SMTP_SERVER ?? "").trim();
  const smtpPortRaw = String(process.env.SMTP_PORT ?? process.env.SMTP_SSL_PORT ?? process.env.SMTP_SUBMISSION_PORT ?? "").trim();
  const smtpUser = String(process.env.SMTP_USER ?? process.env.SMTP_USERNAME ?? "").trim();
  const smtpPass = String(process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? "").trim();
  const smtpPort = Number(smtpPortRaw);
  const smtpSecureRaw = String(process.env.SMTP_SECURE ?? "").trim();
  const smtpSecure = smtpSecureRaw.length > 0 ? parseBoolean(smtpSecureRaw) : smtpPort === 465;
  const from = String(
    params.from
      ?? process.env.ADMIN_REVIEW_NOTIFY_FROM
      ?? process.env.SMTP_FROM
      ?? smtpUser
      ?? "noreply@wohnlagencheck24.de",
  ).trim();

  if (!smtpHost) return { sent: false, reason: "SMTP_HOST missing" };
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) return { sent: false, reason: "SMTP_PORT invalid" };
  if (!smtpUser) return { sent: false, reason: "SMTP_USER missing" };
  if (!smtpPass) return { sent: false, reason: "SMTP_PASS missing" };
  if (!from) return { sent: false, reason: "SMTP_FROM missing" };
  if (!params.to.length) return { sent: false, reason: "MAIL_TO missing" };

  let nodemailerMod: typeof import("nodemailer");
  try {
    nodemailerMod = await import("nodemailer");
  } catch {
    return { sent: false, reason: "nodemailer_missing" };
  }
  const transporter = nodemailerMod.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    await transporter.sendMail({
      from,
      to: params.to.join(", "),
      subject: params.subject,
      text: params.text,
      replyTo: smtpUser || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "smtp_send_failed";
    return { sent: false, reason: `smtp_error:${message}` };
  }

  return { sent: true };
}

export async function sendAdminReviewReadyEmail(args: SendAdminReviewReadyEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipients = (args.recipients ?? []).length > 0
    ? (args.recipients ?? []).map((v) => String(v).trim()).filter((v) => v.length > 0)
    : Array.from(new Set([
      ...parseCsv(String(process.env.ADMIN_REVIEW_NOTIFY_TO ?? "")),
      ...parseCsv(String(process.env.SMTP_TO ?? "")),
      ...parseCsv(String(process.env.SMTP_USER ?? "")),
    ]));
  if (recipients.length === 0) return { sent: false, reason: "ADMIN_REVIEW_NOTIFY_TO missing" };
  return sendSmtpTextMail({
    to: recipients,
    subject: buildSubject(args),
    text: buildText(args),
    from: String(process.env.ADMIN_REVIEW_NOTIFY_FROM ?? "").trim() || null,
  });
}

export async function sendPartnerReviewSubmittedEmail(args: SendPartnerReviewSubmittedEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipient = String(args.partnerEmail ?? "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "partner_email_missing" };
  return sendSmtpTextMail({
    to: [recipient],
    subject: buildPartnerSubject(args),
    text: buildPartnerText(args),
  });
}

export async function sendPartnerAreaApprovedEmail(args: SendPartnerAreaApprovedEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipient = String(args.partnerEmail ?? "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "partner_email_missing" };
  return sendSmtpTextMail({
    to: [recipient],
    subject: buildPartnerApprovedSubject(args),
    text: buildPartnerApprovedText(args),
  });
}

export async function sendAdminPartnerOnboardedEmail(args: SendAdminPartnerOnboardedEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipients = (args.recipients ?? []).length > 0
    ? (args.recipients ?? []).map((v) => String(v).trim()).filter((v) => v.length > 0)
    : Array.from(new Set([
      ...parseCsv(String(process.env.ADMIN_PARTNER_NOTIFY_TO ?? "")),
      ...parseCsv(String(process.env.ADMIN_REVIEW_NOTIFY_TO ?? "")),
      ...parseCsv(String(process.env.SMTP_TO ?? "")),
      ...parseCsv(String(process.env.SMTP_USER ?? "")),
    ]));
  if (recipients.length === 0) return { sent: false, reason: "ADMIN_PARTNER_NOTIFY_TO missing" };
  return sendSmtpTextMail({
    to: recipients,
    subject: buildAdminPartnerOnboardedSubject(args),
    text: buildAdminPartnerOnboardedText(args),
    from: String(process.env.ADMIN_REVIEW_NOTIFY_FROM ?? "").trim() || null,
  });
}

export async function sendPartnerPasswordResetEmail(args: SendPartnerPasswordResetEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipient = String(args.partnerEmail ?? "").trim().toLowerCase();
  const resetLink = String(args.resetLink ?? "").trim();
  if (!recipient) return { sent: false, reason: "partner_email_missing" };
  if (!resetLink) return { sent: false, reason: "reset_link_missing" };

  return sendSmtpTextMail({
    to: [recipient],
    subject: buildPartnerPasswordResetSubject(),
    text: buildPartnerPasswordResetText(args),
  });
}

export async function sendPartnerInviteEmail(args: SendPartnerInviteEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipient = String(args.partnerEmail ?? "").trim().toLowerCase();
  const inviteLink = String(args.inviteLink ?? "").trim();
  if (!recipient) return { sent: false, reason: "partner_email_missing" };
  if (!inviteLink) return { sent: false, reason: "invite_link_missing" };

  return sendSmtpTextMail({
    to: [recipient],
    subject: buildPartnerInviteSubject(args),
    text: buildPartnerInviteText(args),
  });
}

export async function sendPartnerAreaAssignedEmail(args: SendPartnerAreaAssignedEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipient = String(args.partnerEmail ?? "").trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "partner_email_missing" };
  return sendSmtpTextMail({
    to: [recipient],
    subject: buildPartnerAssignedSubject(args),
    text: buildPartnerAssignedText(args),
  });
}

export async function sendAdminInviteResendRequestEmail(args: SendAdminInviteResendRequestEmailArgs): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const recipients = (args.recipients ?? []).length > 0
    ? (args.recipients ?? []).map((v) => String(v).trim()).filter((v) => v.length > 0)
    : Array.from(new Set([
      ...parseCsv(String(process.env.ADMIN_PARTNER_NOTIFY_TO ?? "")),
      ...parseCsv(String(process.env.ADMIN_REVIEW_NOTIFY_TO ?? "")),
      ...parseCsv(String(process.env.SMTP_TO ?? "")),
      ...parseCsv(String(process.env.SMTP_USER ?? "")),
    ]));
  if (recipients.length === 0) return { sent: false, reason: "ADMIN_PARTNER_NOTIFY_TO missing" };
  return sendSmtpTextMail({
    to: recipients,
    subject: buildAdminInviteResendRequestSubject(args),
    text: buildAdminInviteResendRequestText(args),
    from: String(process.env.ADMIN_REVIEW_NOTIFY_FROM ?? "").trim() || null,
  });
}
