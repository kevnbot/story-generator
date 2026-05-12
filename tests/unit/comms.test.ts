import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const state = {
    smsEnabled: true,
    rateLimitAllowed: true,
    twilioFailSms: false,
    user: {
      email: "parent@example.com",
      phone_number: "+15551234567",
      phone_verified: true,
      notification_preferences: [{
        email_marketing: false,
        email_transactional: true,
        sms_marketing: false,
        sms_transactional: true,
      }],
    },
    verificationStatus: "pending",
    verificationCheckStatus: "approved",
  }

  const smsCreate = vi.fn(async () => {
    if (state.twilioFailSms) throw new Error("twilio sms failed")
    return { sid: "SM123" }
  })

  const verificationsCreate = vi.fn(async () => ({
    sid: "VE123",
    status: state.verificationStatus,
  }))

  const verificationChecksCreate = vi.fn(async () => ({
    status: state.verificationCheckStatus,
  }))

  const inserts: Array<{ table: string; payload: unknown }> = []

  const serviceClient = {
    from(table: string) {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: state.user }),
            }),
          }),
        }
      }

      if (table === "comms_log") {
        return {
          insert: async (payload: unknown) => {
            inserts.push({ table, payload })
            return { data: null, error: null }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }

  return {
    state,
    inserts,
    smsCreate,
    verificationsCreate,
    verificationChecksCreate,
    serviceClient,
  }
})

vi.mock("@/lib/config", () => ({
  config: {
    smsEnabled: vi.fn(async () => mocks.state.smsEnabled),
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  checkSmsRateLimit: vi.fn(async () => ({ allowed: mocks.state.rateLimitAllowed, remaining: 19 })),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => mocks.serviceClient),
}))

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: vi.fn(async () => ({ data: { id: "email-id" }, error: null })),
    }
  },
}))

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: mocks.smsCreate,
    },
    verify: {
      v2: {
        services: vi.fn(() => ({
          verifications: { create: mocks.verificationsCreate },
          verificationChecks: { create: mocks.verificationChecksCreate },
        })),
      },
    },
  })),
}))

describe("comms helpers", () => {
  beforeEach(() => {
    mocks.inserts.length = 0
    mocks.state.smsEnabled = true
    mocks.state.rateLimitAllowed = true
    mocks.state.twilioFailSms = false
    mocks.state.verificationStatus = "pending"
    mocks.state.verificationCheckStatus = "approved"
    mocks.smsCreate.mockClear()
    mocks.verificationsCreate.mockClear()
    mocks.verificationChecksCreate.mockClear()
  })

  it("sends transactional SMS and logs success through sendComms", async () => {
    const { sendComms } = await import("@/lib/comms")

    await sendComms({
      userId: "user-1",
      trigger: "story_ready",
      data: { childName: "Luna", storyId: "story-1" },
    })

    expect(mocks.smsCreate).toHaveBeenCalledTimes(1)
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        table: "comms_log",
        payload: expect.objectContaining({
          channel: "sms",
          status: "sent",
          provider_message_id: "SM123",
        }),
      })
    )
  })

  it("logs failed SMS when Twilio message create throws", async () => {
    mocks.state.twilioFailSms = true
    const { sendComms } = await import("@/lib/comms")

    await sendComms({
      userId: "user-1",
      trigger: "story_ready",
      data: { childName: "Luna", storyId: "story-1" },
    })

    expect(mocks.smsCreate).toHaveBeenCalledTimes(1)
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        table: "comms_log",
        payload: expect.objectContaining({
          channel: "sms",
          status: "failed",
          provider_message_id: null,
        }),
      })
    )
  })

  it("does not call Twilio SMS when rate limit disallows", async () => {
    mocks.state.rateLimitAllowed = false
    const { sendComms } = await import("@/lib/comms")

    await sendComms({
      userId: "user-1",
      trigger: "story_ready",
      data: { childName: "Luna", storyId: "story-1" },
    })

    expect(mocks.smsCreate).not.toHaveBeenCalled()
  })

  it("returns pending status for send2faOtp and logs comm", async () => {
    const { send2faOtp } = await import("@/lib/comms")

    const result = await send2faOtp("+15551234567", "user-1")

    expect(result).toBe(true)
    expect(mocks.verificationsCreate).toHaveBeenCalledWith({ to: "+15551234567", channel: "sms" })
    expect(mocks.inserts).toContainEqual(
      expect.objectContaining({
        table: "comms_log",
        payload: expect.objectContaining({
          type: "2fa",
          template_id: "2fa_otp",
          status: "sent",
          provider_message_id: "VE123",
        }),
      })
    )
  })

  it("returns approval status for verify2faOtp", async () => {
    const { verify2faOtp } = await import("@/lib/comms")

    const approved = await verify2faOtp("+15551234567", "123456")

    expect(approved).toBe(true)
    expect(mocks.verificationChecksCreate).toHaveBeenCalledWith({ to: "+15551234567", code: "123456" })

    mocks.state.verificationCheckStatus = "pending"
    const notApproved = await verify2faOtp("+15551234567", "123456")
    expect(notApproved).toBe(false)
  })
})
