import OfficialPageLayout, { OfficialSection } from '../components/OfficialPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <OfficialPageLayout
      eyebrow="Privacy Policy"
      title="Your code stays under your control."
      description="SourceFinch helps developers understand and interact with software repositories through indexing, AI-powered conversations, search, and citations. Last updated: September 8, 2026."
      icon="privacy"
      singleLineTitle
    >
      <p>SourceFinch ("SourceFinch", "we", "us", or "our") is a developer tool that helps users understand and interact with their software repositories using repository indexing, AI-powered conversations, search, and citations.</p>
      <p>By using SourceFinch, you agree to the practices described in this Privacy Policy.</p>

      <OfficialSection title="1. Information We Collect">
        <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">1.1 Account Information</h3>
        <p>When you create or access a SourceFinch account, we may collect information provided by your authentication provider, such as:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name</li><li>Email address</li><li>Profile information</li><li>Authentication provider information</li><li>User or account identifier</li>
        </ul>
        <p>We use this information to create and maintain your account, authenticate you, and provide access to the application.</p>

        <h3 className="mb-2 mt-6 font-semibold text-zinc-900 dark:text-zinc-100">1.2 Repository Information</h3>
        <p>When you connect a repository, we may process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Repository name, owner, organization, URL, and branch</li><li>Repository metadata</li><li>Source code files and file contents</li><li>File paths and directory structure</li><li>Repository indexing information</li>
        </ul>
        <p>SourceFinch processes this information to provide repository search, indexing, AI-powered questions and answers, citations, and related functionality. You should only connect repositories that you are authorized to access and process.</p>

        <h3 className="mb-2 mt-6 font-semibold text-zinc-900 dark:text-zinc-100">1.3 Conversations and Questions</h3>
        <p>When you use SourceFinch AI features, we may collect and store:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Questions you submit</li><li>AI-generated responses</li><li>Conversation history</li><li>Repository context used to generate responses</li><li>Citations and related search information</li>
        </ul>
        <p>This information is used to provide and improve conversation and repository-intelligence features.</p>

        <h3 className="mb-2 mt-6 font-semibold text-zinc-900 dark:text-zinc-100">1.4 Technical Information</h3>
        <p>We may automatically collect limited technical information required to operate and secure the service, such as browser and device type, operating system, IP address, application logs, error and diagnostic information, and login and session information.</p>
      </OfficialSection>

      <OfficialSection title="2. How We Use Your Information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create and manage your account</li><li>Authenticate users</li><li>Connect and process repositories</li><li>Index repository content</li><li>Provide repository search and retrieval</li><li>Generate AI-powered answers</li><li>Provide citations and relevant source references</li><li>Store and display conversation history where supported</li><li>Maintain and improve SourceFinch</li><li>Detect, investigate, and prevent security issues</li><li>Diagnose technical problems</li><li>Communicate with you about the service</li><li>Comply with applicable legal obligations</li>
        </ul>
        <p>We do not use repository content for purposes unrelated to providing SourceFinch functionality unless we have your permission or are legally required to do so.</p>
      </OfficialSection>

      <OfficialSection title="3. Repository Access">
        <p>SourceFinch may require access to repositories that you choose to connect. Repository access is used to retrieve information necessary for indexing, search, AI, and citation features.</p>
        <p>You are responsible for ensuring that you have the necessary rights and permissions to connect a repository. You can remove a connected repository where the application provides that functionality. Removing a repository may cause associated indexed data and repository-related information to be deleted, subject to applicable retention requirements and technical limitations.</p>
      </OfficialSection>

      <OfficialSection title="4. AI Processing">
        <p>SourceFinch uses artificial intelligence to answer questions about connected repositories. To generate an answer, SourceFinch may send relevant repository content, search results, conversation information, or other necessary context to the AI service used by the application.</p>
        <p>The AI may process this information solely to generate the requested response and provide SourceFinch functionality, subject to the applicable AI provider's terms and policies. AI-generated responses may contain errors and should be reviewed before being relied upon for important technical, security, or production decisions.</p>
      </OfficialSection>

      <OfficialSection title="5. Data Storage">
        <p>SourceFinch may store account information, repository metadata, indexed repository information, conversation history, and application and security logs. The exact information stored may depend on the features you use.</p>
        <p>We retain information only as long as reasonably necessary to provide the service, maintain security, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
      </OfficialSection>

      <OfficialSection title="6. Data Sharing">
        <p>We do not sell your personal information or repository content. We may share or provide access to information with trusted service providers responsible for authentication, hosting and infrastructure, databases, AI processing, vector search or indexing, monitoring, and error reporting.</p>
        <p>These providers receive only the information reasonably necessary to provide their services. We may also disclose information when required by law or when necessary to protect the rights, security, and integrity of SourceFinch, our users, or others.</p>
      </OfficialSection>

      <OfficialSection title="7. Third-Party Services">
        <p>SourceFinch may use third-party services for authentication, hosting, AI processing, storage, search, or other application functionality. These services may process information according to their own privacy policies and terms.</p>
      </OfficialSection>

      <OfficialSection title="8. Data Security">
        <p>We take reasonable technical and organizational measures to protect information against unauthorized access, alteration, disclosure, or destruction. However, no internet-based service can guarantee absolute security.</p>
        <p>You are responsible for maintaining the security of your account and connected repositories.</p>
      </OfficialSection>

      <OfficialSection title="9. Your Responsibilities">
        <ul className="list-disc space-y-1 pl-5"><li>Connect only repositories you are authorized to access.</li><li>Protect your account credentials.</li><li>Review AI-generated results before relying on them.</li><li>Ensure repository content may legally be processed.</li><li>Avoid submitting unnecessary sensitive or confidential information.</li></ul>
      </OfficialSection>

      <OfficialSection title="10. Data Deletion">
        <p>You may request deletion of your SourceFinch account and associated personal information by contacting <a className="font-medium underline underline-offset-2 hover:text-zinc-950 dark:hover:text-white" href="mailto:adityahire08@gmail.com">adityahire08@gmail.com</a>. Where supported, you may also remove connected repositories directly through SourceFinch.</p>
        <p>Deleted information may remain temporarily in backups, logs, or systems where immediate deletion is technically impractical or where retention is required by law.</p>
      </OfficialSection>

      <OfficialSection title="11. Your Privacy Rights">
        <p>Depending on your location and applicable law, you may have rights to request access, correction, deletion, or information about processing; withdraw consent; or object to or restrict certain processing activities. To exercise applicable rights, contact <a className="font-medium underline underline-offset-2 hover:text-zinc-950 dark:hover:text-white" href="mailto:adityahire08@gmail.com">adityahire08@gmail.com</a>. We may need to verify your identity.</p>
      </OfficialSection>

      <OfficialSection title="12. Children's Privacy">
        <p>SourceFinch is not intended for children who are not legally permitted to use the service under applicable law. We do not knowingly collect personal information from children in violation of applicable requirements.</p>
      </OfficialSection>

      <OfficialSection title="13. International Data Transfers">
        <p>SourceFinch and its service providers may process or store information in countries other than the country where you live. Where required, we will take appropriate measures to protect personal information during cross-border transfers.</p>
      </OfficialSection>

      <OfficialSection title="14. Changes to This Privacy Policy">
        <p>We may update this Privacy Policy to reflect changes to SourceFinch, our practices, or applicable legal requirements. Significant changes may be announced through the application or other appropriate means.</p>
      </OfficialSection>

      <OfficialSection title="15. Contact Us">
        <p>For questions, concerns, or requests regarding this Privacy Policy, contact us at <a className="font-medium underline underline-offset-2 hover:text-zinc-950 dark:hover:text-white" href="mailto:adityahire08@gmail.com">adityahire08@gmail.com</a>.</p>
      </OfficialSection>
    </OfficialPageLayout>
  );
}
