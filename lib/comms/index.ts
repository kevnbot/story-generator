import { createServiceClient } from "@/lib/supabase/server"
import { config } from "@/lib/config"
import { checkSmsRateLimit } from "@/lib/rate-limit"
import type { SendCommsParams, CommTrigger } from "@/types"

// ─── Email sender (Resend) ────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string, templateId: string, userId: string) {
  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to,
      subject,
      html,
    })

    await logComm({
      userId,
      channel: "email",
      type: getCommType(templateId),
      templateId,
      recipient: to,
      status: error ? "failed" : "sent",
      providerMessageId: data?.id ?? null,
      errorMessage: error?.message ?? null,
    })

    return !error
  } catch (err) {
    await logComm({ userId, channel: "email", type: getCommType(templateId), templateId, recipient: to, status: "failed", providerMessageId: null, errorMessage: String(err) })
    return false
  }
}

// ─── SMS sender (Twilio) ─────────────────────────────────────────────────────

async function sendSms(to: string, body: string, templateId: string, userId: string) {
  const smsEnabled = await config.smsEnabled()
  if (!smsEnabled) return false

  const { allowed } = await checkSmsRateLimit(userId)
  if (!allowed) return false

  const twilio = (await import("twilio")).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    })

    await logComm({
      userId,
      channel: "sms",
      type: getCommType(templateId),
      templateId,
      recipient: to,
      status: "sent",
      providerMessageId: message.sid,
      errorMessage: null,
    })

    return true
  } catch (err) {
    await logComm({ userId, channel: "sms", type: getCommType(templateId), templateId, recipient: to, status: "failed", providerMessageId: null, errorMessage: String(err) })
    return false
  }
}

// ─── Main send function ───────────────────────────────────────────────────────

export async function sendComms({ userId, trigger, data = {} }: SendCommsParams) {
  const supabase = createServiceClient()

  // Fetch user + preferences in one query
  const { data: user } = await supabase
    .from("users")
    .select("email, phone_number, phone_verified, notification_preferences(*)")
    .eq("id", userId)
    .single()

  if (!user) return

  const prefs = (user as any).notification_preferences?.[0]
  const template = getTemplate(trigger, data)
  if (!template) return

  const sends: Promise<boolean>[] = []

  // Email
  if (shouldSendEmail(trigger, prefs)) {
    sends.push(sendEmail(user.email, template.emailSubject, template.emailHtml, trigger, userId))
  }

  // SMS
  if (shouldSendSms(trigger, prefs, user.phone_number, user.phone_verified)) {
    sends.push(sendSms(user.phone_number!, template.smsBody, trigger, userId))
  }

  await Promise.allSettled(sends)
}

// ─── 2FA via Twilio Verify ────────────────────────────────────────────────────

export async function send2faOtp(phoneNumber: string, userId: string) {
  const twilio = (await import("twilio")).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  const verification = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
    .verifications.create({ to: phoneNumber, channel: "sms" })

  await logComm({ userId, channel: "sms", type: "2fa", templateId: "2fa_otp", recipient: phoneNumber, status: "sent", providerMessageId: verification.sid, errorMessage: null })

  return verification.status === "pending"
}

export async function verify2faOtp(phoneNumber: string, code: string) {
  const twilio = (await import("twilio")).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  const result = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
    .verificationChecks.create({ to: phoneNumber, code })

  return result.status === "approved"
}

// ─── Gate checks ─────────────────────────────────────────────────────────────

function shouldSendEmail(trigger: CommTrigger, prefs: any): boolean {
  if (!prefs) return trigger === "signup_welcome" || trigger === "purchase_receipt"
  if (trigger === "signup_welcome" || trigger === "purchase_receipt") return true
  if (trigger === "marketing_promo") return prefs.email_marketing
  return prefs.email_transactional
}

function shouldSendSms(trigger: CommTrigger, prefs: any, phone: string | null, verified: boolean): boolean {
  if (!phone || !verified || !prefs) return false
  if (trigger === "marketing_promo") return prefs.sms_marketing
  if (trigger === "signup_welcome" || trigger === "purchase_receipt") return false
  return prefs.sms_transactional
}

// ─── Template definitions ─────────────────────────────────────────────────────

function getTemplate(trigger: CommTrigger, data: Record<string, string | number>) {
  const templates: Record<CommTrigger, { emailSubject: string; emailHtml: string; smsBody: string } | null> = {
    signup_welcome: {
      emailSubject: "Welcome to Story Generator ✨",
      emailHtml: `<p>Hi ${data.name || "there"},</p><p>Welcome to Story Generator! You have <strong>${data.credits || 30} Dream Coins</strong> ready to spend. Create your first bedtime story tonight.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/generate">Create your first story →</a></p>`,
      smsBody: `Welcome to Story Generator! You have ${data.credits || 30} Dream Coins ready. Create your first bedtime story: ${process.env.NEXT_PUBLIC_APP_URL}/generate`,
    },
    story_ready: {
      emailSubject: `✨ ${data.childName}'s story is ready!`,
      emailHtml: `<p>Your bedtime story for <strong>${data.childName}</strong> is ready to read!</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/library/${data.storyId}">Read the story →</a></p>`,
      smsBody: `${data.childName}'s bedtime story is ready! Read it here: ${process.env.NEXT_PUBLIC_APP_URL}/library/${data.storyId}`,
    },
    low_credits: {
      emailSubject: "You're running low on Dream Coins",
      emailHtml: `<p>Your Story Generator balance is down to <strong>${data.balance} Dream Coins</strong>. Top up to keep the stories going!</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/credits">Buy Dream Coins →</a></p>`,
      smsBody: `Story Generator: Only ${data.balance} Dream Coins left. Top up here: ${process.env.NEXT_PUBLIC_APP_URL}/credits`,
    },
    purchase_receipt: {
      emailSubject: `Receipt: ${data.credits} Dream Coins added`,
      emailHtml: `<p>You purchased <strong>${data.credits} Dream Coins</strong> for <strong>$${data.amount}</strong>. Your new balance is ${data.newBalance} coins.</p>`,
      smsBody: `Story Generator: ${data.credits} Dream Coins added. New balance: ${data.newBalance} coins.`,
    },
    marketing_promo: {
      emailSubject: String(data.subject || "News from Story Generator"),
      emailHtml: String(data.html || ""),
      smsBody: String(data.smsBody || ""),
    },
  }
  return templates[trigger]
}

function getCommType(templateId: string): "transactional" | "marketing" | "2fa" {
  if (templateId === "2fa_otp") return "2fa"
  if (templateId === "marketing_promo") return "marketing"
  return "transactional"
}

// ─── Logging ─────────────────────────────────────────────────────────────────

async function logComm(params: {
  userId: string; channel: "email" | "sms"; type: "transactional" | "marketing" | "2fa"
  templateId: string; recipient: string; status: string; providerMessageId: string | null; errorMessage: string | null
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from("comms_log").insert({
      user_id: params.userId,
      channel: params.channel,
      type: params.type,
      template_id: params.templateId,
      recipient: params.recipient,
      status: params.status,
      provider_message_id: params.providerMessageId,
      error_message: params.errorMessage,
    })
  } catch {}
}
