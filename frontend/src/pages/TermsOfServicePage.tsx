import OfficialPageLayout, { OfficialSection } from '../components/OfficialPageLayout';

export default function TermsOfServicePage() {
  return (
    <OfficialPageLayout
      eyebrow="Terms of Service"
      title="Use SourceFinch responsibly."
      description="These Terms of Service govern your access to SourceFinch and its repository intelligence features. Last updated: September 9, 2026."
      icon="terms"
    >
      <OfficialSection title="1. Acceptance and eligibility">
        <p>By accessing or using SourceFinch, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the service. You must be legally permitted to use SourceFinch in your jurisdiction and have authority to accept these terms on behalf of any organization you represent.</p>
      </OfficialSection>
      <OfficialSection title="2. Accounts and access">
        <p>You are responsible for maintaining accurate account information and protecting access to your account. You are responsible for activity performed through your account and must promptly notify us of unauthorized access or suspected security issues.</p>
      </OfficialSection>
      <OfficialSection title="3. Repository responsibility">
        <p>You may connect only repositories and other information that you are authorized to access and process. You are responsible for complying with applicable licenses, confidentiality obligations, privacy laws, and agreements governing connected repositories.</p>
        <p>SourceFinch does not claim ownership of your repository content. You grant SourceFinch the limited permission needed to access, index, store, retrieve, and process that content to provide the service.</p>
      </OfficialSection>
      <OfficialSection title="4. Acceptable use">
        <p>You may use SourceFinch for lawful software research, development, debugging, and documentation. You may not misuse the service, bypass authentication or access controls, interfere with its operation, introduce malicious code, abuse connected infrastructure, infringe another person’s rights, or use the service for unlawful or harmful activity.</p>
      </OfficialSection>
      <OfficialSection title="5. AI-generated output">
        <p>SourceFinch uses automated systems to generate answers from repository context. Outputs may be inaccurate, incomplete, outdated, or unsuitable for your specific codebase. You must review and test all explanations, recommendations, code, and security observations before relying on them.</p>
        <p>SourceFinch is not a substitute for professional software, legal, security, or compliance advice.</p>
      </OfficialSection>
      <OfficialSection title="6. Third-party services">
        <p>SourceFinch may depend on third-party services for authentication, hosting, repository access, AI processing, storage, search, or other functionality. Third-party services may have their own terms and policies, and their availability is outside SourceFinch's control.</p>
      </OfficialSection>
      <OfficialSection title="7. Availability and changes">
        <p>SourceFinch is under active development. Features, limits, integrations, response quality, and availability may change or be interrupted. We may update these terms when the service or applicable legal requirements change. Continued use after an update means you accept the revised terms.</p>
      </OfficialSection>
      <OfficialSection title="8. Suspension and termination">
        <p>We may suspend or terminate access when these terms are violated, when necessary to protect the service or its users, or when required by law. You may stop using SourceFinch at any time. Provisions concerning ownership, disclaimers, limitations of liability, and dispute-related obligations survive termination where applicable.</p>
      </OfficialSection>
      <OfficialSection title="9. Disclaimers and limitation of liability">
        <p>To the extent permitted by law, SourceFinch is provided on an "as is" and "as available" basis without warranties of any kind. We do not guarantee that the service will be uninterrupted, secure, error-free, or that its outputs will be accurate or complete.</p>
        <p>To the extent permitted by law, SourceFinch and its contributors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, profits, or business resulting from your use of or inability to use the service.</p>
      </OfficialSection>
      <OfficialSection title="10. Contact">
        <p>For questions about these terms, contact us at <a className="font-medium underline underline-offset-2 hover:text-zinc-950 dark:hover:text-white" href="mailto:adityahire08@gmail.com">adityahire08@gmail.com</a>.</p>
      </OfficialSection>
    </OfficialPageLayout>
  );
}
