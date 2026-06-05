import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage, LegalSection, LegalP, LegalList } from "@/components/marketing/LegalPage"

export const metadata: Metadata = {
  title: "Terms of Use — My Genie Stories",
  description:
    "The terms and conditions for using My Genie Stories, the personalized AI bedtime story service for families.",
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" lastUpdated="June 5, 2026">
      <LegalP>
        Welcome to My Genie Stories. These Terms of Use (&ldquo;Terms&rdquo;) govern your access to
        and use of the My Genie Stories website, applications, and services (collectively, the
        &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these
        Terms and to our{" "}
        <Link href="/privacy" className="font-medium underline" style={{ color: "#7c3aed" }}>
          Privacy Policy
        </Link>
        . If you do not agree, please do not use the Service.
      </LegalP>

      <LegalSection heading="1. Who can use the Service">
        <LegalP>
          The Service is intended for use by adults (18 years or older) who create stories for the
          children in their care. You are responsible for supervising any child who uses or views
          content created through your account. By using the Service, you represent that you are at
          least 18 years old and have the authority to enter into these Terms.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. Your account">
        <LegalP>
          You are responsible for the information you provide and for all activity that occurs under
          your account. Keep your password secure and notify us promptly of any unauthorized use.
          You may add profiles for your children and family members; you are responsible for having
          the right to provide any information you enter about them.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. Wishes, plans, and payments">
        <LegalList
          items={[
            "Stories are created using “wishes” (credits). New accounts receive a number of free wishes, and additional wishes are available through paid plans.",
            "Paid plans renew automatically for the period you select until cancelled. You can manage or cancel your subscription at any time from your billing settings.",
            "Except where required by law, wishes and fees are non-refundable, and wishes have no cash value.",
            "We may change pricing or plan features; we will provide notice of material changes before they take effect for you.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Stories and content">
        <LegalP>
          The Service uses artificial intelligence to generate stories and illustrations based on
          the inputs you provide. As between you and us, the stories you generate are yours to read,
          print, and share for personal, non-commercial family use. You are responsible for the
          inputs you submit and for reviewing generated content before sharing it with children.
        </LegalP>
        <LegalP>
          AI-generated content may occasionally be inaccurate, unexpected, or not to your taste.
          While we build in guardrails to keep stories age-appropriate, you should review content
          before reading it to a child.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <LegalP>You agree not to use the Service to:</LegalP>
        <LegalList
          items={[
            "Create content that is unlawful, harmful, hateful, sexually explicit, or that exploits or endangers children.",
            "Upload information or images you do not have the right to use, or that infringe someone else’s rights.",
            "Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service.",
            "Resell or commercially exploit the Service or generated content without our permission.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Intellectual property">
        <LegalP>
          The Service, including its software, branding, and mascot, is owned by My Genie Stories
          and protected by intellectual property laws. These Terms do not grant you any right to our
          trademarks or branding except as needed to use the Service.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. Disclaimers and limitation of liability">
        <LegalP>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind, to the fullest
          extent permitted by law. To the maximum extent permitted by law, My Genie Stories will not
          be liable for any indirect, incidental, or consequential damages, and our total liability
          relating to the Service will not exceed the amount you paid us in the twelve months before
          the claim.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. Termination">
        <LegalP>
          You may stop using the Service and delete your account at any time. We may suspend or
          terminate access if you violate these Terms or use the Service in a way that could harm
          others or us.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. Changes to these Terms">
        <LegalP>
          We may update these Terms from time to time. If we make material changes, we will update
          the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you. Your
          continued use of the Service after changes take effect means you accept the updated Terms.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. Contact us">
        <LegalP>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:support@mygeniestories.com" className="font-medium underline" style={{ color: "#7c3aed" }}>
            support@mygeniestories.com
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalPage>
  )
}
