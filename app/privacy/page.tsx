import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection, LegalP, LegalList } from "@/components/marketing/LegalPage"

export const metadata: Metadata = {
  title: "Privacy Policy — My Genie Stories",
  description:
    "How My Genie Stories collects, uses, and protects your family's information when you create personalized stories.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 5, 2026">
      <LegalP>
        My Genie Stories (&ldquo;we,&rdquo; &ldquo;us&rdquo;) helps families create personalized,
        AI-illustrated stories. We take your family&apos;s privacy seriously. This Privacy Policy
        explains what information we collect, how we use it, and the choices you have. It applies to
        the My Genie Stories website and services, works alongside our{" "}
        <Link href="/terms" className="font-medium underline" style={{ color: "#7c3aed" }}>
          Terms of Use
        </Link>
        , and is intended for residents of the United States only.
      </LegalP>

      <LegalSection heading="1. Who we are designed for">
        <LegalP>
          My Genie Stories is designed for parents and caregivers (adults 18+), not for direct use
          by children. Accounts are created and controlled by adults. Any information about a child
          is provided by the adult account holder, who is responsible for that information. We do
          not knowingly collect personal information directly from children under 13. If you believe
          a child has created an account without a parent&apos;s involvement, please contact us and
          we will promptly delete it.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <LegalList
          items={[
            "Account information: your name, email address, and password (stored as a secure hash \u2014 we never store your plain-text password).",
            "Character profiles you create: a child\u2019s first name or nickname, age, gender, appearance description, personality traits, and favorite toy. Text descriptions only \u2014 no photographs of children are collected or stored.",
            "Story content: the stories and illustrations you generate and the inputs you provide to create them.",
            "Billing information: your plan and payment status. Card details are handled by Stripe and are not stored on our servers.",
            "Usage and device data: pages visited, features used, device type, browser, IP address, and analytics needed to operate and secure the Service.",
            "Legal acceptance records: the date, time, and version of Terms you agreed to when creating your account.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. How we use information">
        <LegalList
          items={[
            "To generate your personalized stories and illustrations and keep them in your library.",
            "To operate, secure, and improve the Service, including troubleshooting and preventing abuse.",
            "To process payments, manage your plan, and grant your wishes.",
            "To communicate with you about your account, security, and important service updates.",
            "To improve our AI models using generated story outputs (not child profile descriptions \u2014 see Section 4).",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Children\u2019s information (COPPA)">
        <LegalP>
          Profile details about your child are used only to personalize the stories you create. We
          do not use a child&apos;s profile information for AI training, targeted advertising, or
          any purpose other than generating your stories. We do not sell children&apos;s information.
          You can view, edit, or delete child profiles at any time from your account settings.
        </LegalP>
        <LegalP>
          As a parent or guardian, you have the right to review the information we hold about your
          child, request its deletion, and refuse further collection by deleting the profile or
          closing your account. To exercise these rights, contact us at{" "}
          <a href="mailto:privacy@mygeniestories.com" className="font-medium underline" style={{ color: "#7c3aed" }}>
            privacy@mygeniestories.com
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. AI training and generated content">
        <LegalP>
          Generated story text and illustrations may be used to train, evaluate, and improve our AI
          systems. This helps us make better stories for every family. We do not use child profile
          descriptions (name, appearance, personality) for AI training — only the generated story
          output, stripped of personally identifying information. This is covered in more detail in
          our Terms of Use.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Service providers we work with">
        <LegalP>
          We share information with trusted providers who help us run the Service. Each is bound by
          agreements limiting their use of your data:
        </LegalP>
        <LegalList
          items={[
            "Supabase \u2014 database, authentication, and file storage.",
            "Vercel \u2014 web hosting and infrastructure.",
            "Anthropic \u2014 AI story text generation (receives story prompts and character descriptions).",
            "fal.ai \u2014 AI illustration generation (receives text descriptions of characters and scenes).",
            "Stripe \u2014 payment processing.",
            "Resend \u2014 transactional email.",
            "Twilio \u2014 SMS notifications (only if you opt in).",
            "Upstash \u2014 rate limiting (receives IP address only).",
            "Sentry \u2014 error tracking and monitoring.",
          ]}
        />
        <LegalP>
          We do not sell your personal information. We do not allow providers to use your content
          to train their own models beyond what is necessary to provide the Service to you.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. Data retention">
        <LegalP>
          We keep your information for as long as your account is active or as needed to provide the
          Service. When you delete a profile, story, or your account, we remove the associated
          content, subject to a short period for backups. Payment records and legal acceptance logs
          are retained for up to 7 years as required by law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Security">
        <LegalP>
          We use technical and organizational measures to protect your information, including
          encryption in transit (HTTPS), encryption at rest, and row-level access controls on our
          database. No system is perfectly secure, but we work to protect your family&apos;s data
          and to notify you of significant incidents where required by law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Your choices and rights">
        <LegalList
          items={[
            "Access, update, or delete your account and profiles from your account settings.",
            "Manage or cancel your subscription from your billing settings.",
            "Opt out of non-essential emails using the unsubscribe link or by contacting us.",
            "Request complete deletion of your account and all associated data by emailing us. We will process requests within 30 days.",
            "California residents: you have the right to know what personal information we collect, request deletion, and opt out of the sale of personal information. We do not sell personal information. To exercise your rights, contact us at privacy@mygeniestories.com.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="10. Changes to this Policy">
        <LegalP>
          We may update this Privacy Policy from time to time. We will update the &ldquo;Last
          updated&rdquo; date above and, for material changes, notify you and ask you to re-accept
          before continuing to use the Service.
        </LegalP>
      </LegalSection>

      <LegalSection heading="11. Contact us">
        <LegalP>
          Questions about your privacy or this policy? Contact us at{" "}
          <a href="mailto:privacy@mygeniestories.com" className="font-medium underline" style={{ color: "#7c3aed" }}>
            privacy@mygeniestories.com
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalPage>
  )
}
