import OfficialPageLayout, { OfficialSection } from '../components/OfficialPageLayout';

export default function TermsOfServicePage() {
  return (
    <OfficialPageLayout
      eyebrow="Terms of Service"
      title="Use SourceFinch responsibly."
      description="These terms describe the basic expectations for using SourceFinch and its repository intelligence features."
      icon="terms"
    >
      <OfficialSection title="Using the service">
        <p>You may use SourceFinch for lawful software research, development, debugging, and documentation. You are responsible for the repositories and information you connect to the service.</p>
      </OfficialSection>
      <OfficialSection title="Repository responsibility">
        <p>You must have permission to access and process any repository you connect. Do not use SourceFinch to expose, copy, or distribute code that you are not authorized to handle.</p>
      </OfficialSection>
      <OfficialSection title="AI-generated responses">
        <p>SourceFinch provides code-grounded assistance, but responses may contain mistakes or omissions. Review generated explanations, suggested changes, and security observations before relying on them.</p>
      </OfficialSection>
      <OfficialSection title="Acceptable use">
        <p>You may not misuse the service, attempt to bypass authentication, interfere with its operation, abuse connected infrastructure, or use it to violate another person’s rights.</p>
      </OfficialSection>
      <OfficialSection title="Availability and changes">
        <p>Features may change as the product develops. SourceFinch is provided on an ongoing development basis, and availability or response quality may vary.</p>
      </OfficialSection>
      <OfficialSection title="Contact and termination">
        <p>Access may be limited or terminated when these terms are violated or when needed to protect the service and its users. Questions can be raised through the project repository.</p>
      </OfficialSection>
    </OfficialPageLayout>
  );
}
