// ─── Database row types ───────────────────────────────────────────────────────

export type AccountPlan = "free" | "starter" | "family"
export type UserRole = "owner" | "parent" | "viewer"
export type AuthProvider = "email" | "google" | "apple"
export type GenerationJobStatus = "pending" | "generating" | "complete" | "failed"
export type CommChannel = "email" | "sms"
export type CommType = "transactional" | "marketing" | "2fa"
export type CommStatus = "sent" | "delivered" | "failed" | "bounced" | "opted_out"
export type CreditTransactionType = "purchase" | "spend" | "refund" | "promo"

export interface Account {
  id: string
  name: string
  credit_balance: number
  plan: AccountPlan
  created_at: string
}

export interface User {
  id: string
  account_id: string
  email: string
  role: UserRole
  display_name: string | null
  avatar_url: string | null
  auth_provider: AuthProvider
  phone_number: string | null
  phone_verified: boolean
  deleted_at: string | null
  created_at: string
}

export interface KidAppearance {
  hair?: string         // free-text description (new)
  hair_color?: string   // legacy field, kept for existing records
  hair_style?: string   // legacy field, kept for existing records
  eye_color?: string
  skin_tone?: string
  glasses?: boolean
  freckles?: boolean
  other?: string
}

export interface KidToy {
  name: string
  type?: string
  color?: string
  description?: string
  backstory?: string
}

export interface KidProfile {
  id: string
  account_id: string
  name: string
  age: number
  age_months: number
  gender?: string
  appearance: KidAppearance
  personality_tags: string[]
  toy: KidToy
  prompt_summary: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface StoryTemplate {
  id: string
  name: string
  description: string
  system_prompt: string
  user_prompt_template: string
  image_prompt_template: string
  credits_cost: number
  is_active: boolean
  created_at: string
}

export interface GenerationJob {
  id: string
  account_id: string
  user_id: string
  kid_profile_id: string
  story_template_id: string
  status: GenerationJobStatus
  credits_held: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface StoryImage {
  url: string
  caption: string | null
  scene_index: number
}

export interface GenerationParams {
  kid_profile_id: string
  story_template_id: string
  prompt_summary: string
  system_prompt: string
  user_prompt: string
  image_prompt: string
  model: string
  image_model: string
}

export interface Story {
  id: string
  account_id: string
  user_id: string
  kid_profile_id: string | null
  story_template_id: string | null
  job_id: string | null
  title: string
  content: string
  images: StoryImage[]
  generation_params: GenerationParams
  credits_used: number
  deleted_at: string | null
  created_at: string
}

export interface CreditTransaction {
  id: string
  account_id: string
  user_id: string
  amount: number
  type: CreditTransactionType
  description: string | null
  stripe_session_id: string | null
  created_at: string
}

export interface NotificationPreferences {
  id: string
  user_id: string
  email_transactional: boolean
  email_marketing: boolean
  sms_transactional: boolean
  sms_marketing: boolean
  sms_2fa: boolean
  consent_recorded_at: string | null
  consent_ip: string | null
  updated_at: string
}

export interface CommsLog {
  id: string
  user_id: string
  channel: CommChannel
  type: CommType
  template_id: string | null
  recipient: string
  status: CommStatus
  provider_message_id: string | null
  error_message: string | null
  sent_at: string
}

export interface AppConfig {
  id: string
  key: string
  value: string
  description: string
  updated_at: string
}

// ─── API response types ───────────────────────────────────────────────────────

export interface ApiSuccess<T = void> {
  success: true
  data?: T
}

export interface ApiError {
  success: false
  error: string
  code?: string
}

export type ApiResponse<T = void> = ApiSuccess<T> | ApiError

// ─── Comms types ─────────────────────────────────────────────────────────────

export interface SendCommsParams {
  userId: string
  trigger: CommTrigger
  data?: Record<string, string | number>
}

export type CommTrigger =
  | "signup_welcome"
  | "story_ready"
  | "low_credits"
  | "purchase_receipt"
  | "marketing_promo"
