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
        the My Genie Stories website and services and works alongside our{" "}
        <Link href="/terms" className="font-medium underline" style={{ color: "#7c3aed" }}>
          Terms of Use
        </Link>
        .
      </LegalP>

      <LegalSection heading="1. Who we are designed for">
        <LegalP>
          My Genie Stories is designed for parents and caregivers (adults 18+), not for direct use
          by children. Accounts are created and controlled by adults. Any information about a child
          is provided by the adult account holder, who is responsible for that information.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <LegalList
          items={[
            "Account information: your name, email address, and password.",
            "Family and character profiles you create: a child’s first name, age, appearance details, personality traits, favorite toy, and any reference image you choose to upload.",
            "Story content: the stories and illustrations you generate and the inputs you provide to create them.",
            "Billing information: your plan and payment status. Card details are handled by our payment processor (Stripe) and are not stored on our servers.",
            "Usage and device data: log data, approximate location, and analytics needed to operate and secure the Service.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. How we use information">
        <LegalList
          items={[
            "To create your personalized stories and illustrations and keep them in your library.",
            "To operate, secure, and improve the Service, including troubleshooting and preventing abuse.",
            "To process payments, manage your plan, and grant your wishes.",
            "To communicate with you about your account, security, and important service updates.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Children's information">
        <LegalP>
          Profile details about your child are used only to personalize the stories you create and
          are tied to your account. We do not use a child&apos;s information to serve targeted
          advertising, and we do not sell personal information. You can view, edit, or delete child
          profiles at any time from your account. If you believe a child has created an account
          without a parent&apos;s involvement, please contact us and we will address it.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. AI processing and service providers">
        <LegalP>
          We share information with trusted service providers who help us run the Service, under
          agreements that limit their use of the data:
        </LegalP>
        <LegalList
          items={[
            "AI providers that generate story text and illustrations from the inputs you submit.",
            "Cloud hosting and storage providers that run the Service and store your content.",
            "A payment processor (Stripe) to handle subscriptions and billing.",
            "Communications and error-monitoring tools to deliver emails and keep the Service reliable.",
          ]}
        />
        <LegalP>
          We do not sell your personal information, and we do not allow our providers to use your
          content to train their own models except as needed to provide the Service to you.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. Data retention">
        <LegalP>
          We keep your information for as long as your account is active or as needed to provide the
          Service. When you delete a profile, story, or your account, we remove the associated
          content, subject to a short period for backups and any retention required by law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. Security">
        <LegalP>
          We use technical and organizational measures to protect your information, including
          encryption in transit and access controls. No system is perfectly secure, but we work to
          protect your family&apos;s data and to notify you of significant incidents where required.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Your choices and rights">
        <LegalList
          items={[
            "Access, update, or delete your account and profiles from your account settings.",
            "Manage or cancel your subscription from your billing settings.",
            "Opt out of non-essential emails using the unsubscribe link or by contacting us.",
            "Depending on where you live, you may have additional rights to access, correct, or delete your data — contact us to exercise them.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="9. Changes to this Policy">
        <LegalP>
          We may update this Privacy Policy from time to time. We will update the &ldquo;Last
          updated&rdquo; date above and, for material changes, provide additional notice where
          appropriate.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. Contact us">
        <LegalP>
          Questions about your privacy? Contact us at{" "}
          <a href="mailto:privacy@mygeniestories.com" className="font-medium underline" style={{ color: "#7c3aed" }}>
            privacy@mygeniestories.com
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalPage>
  )
}
