import OfficialPageLayout, { OfficialSection } from '../components/OfficialPageLayout';

export default function DocumentationPage() {
  return (
    <OfficialPageLayout
      eyebrow="SourceFinch Documentation"
      title="Understand your codebase with confidence."
      description="A practical guide to connecting repositories, asking grounded questions, and inspecting the source behind every answer."
      icon="docs"
    >
      <OfficialSection title="Getting started">
        <p>Sign in, open the workspace, and add a public GitHub repository. Choose a branch when needed. SourceFinch processes the repository before it becomes available for questions.</p>
      </OfficialSection>
      <OfficialSection title="Repository indexing">
        <p>During indexing, SourceFinch scans supported files, creates searchable code chunks, and prepares them for retrieval. The workspace shows the repository status supplied by the application.</p>
      </OfficialSection>
      <OfficialSection title="Asking questions">
        <p>Ask about architecture, routing, data flow, bugs, or specific files. Answers are grounded in the indexed repository context rather than invented project metrics or unrelated examples.</p>
      </OfficialSection>
      <OfficialSection title="Citations and code inspection">
        <p>When an answer includes source citations, select a citation to inspect its file and line range in the code viewer. You can copy code, open the related GitHub permalink, or ask a focused follow-up question.</p>
      </OfficialSection>
      <OfficialSection title="History and files">
        <p>Use History to return to previous conversations and Files to browse the indexed repository tree. These views are scoped to the selected repository.</p>
      </OfficialSection>
    </OfficialPageLayout>
  );
}
