export type ContentStudioPipelineKey = "dpe_content" | "study_flashcards";

export type ContentStudioTemplate = {
  description: string;
  label: string;
  value: string;
};

export const contentStudioPipelines: {
  description: string;
  key: ContentStudioPipelineKey;
  label: string;
  sourceHint: string;
  targetArtifact: string;
}[] = [
  {
    description:
      "Turn source notes, outlines, or imported learning material into curated Study flashcard decks.",
    key: "study_flashcards",
    label: "Study flashcard set",
    sourceHint: "Chapter notes, study guides, CSV exports, or pasted source text.",
    targetArtifact: "Reviewable deck draft with terms, definitions, hints, and trust metadata.",
  },
  {
    description:
      "Prepare DPE oral-practice content with answer keys, rubrics, ACS references, and review notes.",
    key: "dpe_content",
    label: "DPE content",
    sourceHint: "ACS tasks, examiner notes, aviation references, or curated question banks.",
    targetArtifact: "Reviewed DPE question, answer key, rubric, and source-reference package.",
  },
];

export const contentStudioTemplatesByPipeline: Record<
  ContentStudioPipelineKey,
  ContentStudioTemplate[]
> = {
  dpe_content: [
    {
      description: "Build answer keys and rubrics from vetted ACS-aligned source material.",
      label: "ACS answer key and rubric",
      value: "acs_answer_key_rubric",
    },
    {
      description: "Find source gaps before generation starts.",
      label: "DPE source coverage audit",
      value: "dpe_source_coverage",
    },
  ],
  study_flashcards: [
    {
      description: "Create concise term and definition pairs with optional hints.",
      label: "Flashcard set generator",
      value: "flashcard_set_generator",
    },
    {
      description: "Normalize imported flashcards before verification.",
      label: "Deck cleanup and taxonomy",
      value: "deck_cleanup_taxonomy",
    },
    {
      description: "Save reviewed source-pack decisions as an Admin artifact before Study draft generation.",
      label: "Source-pack review export",
      value: "source_pack_review_export",
    },
  ],
};

export const contentStudioStages = [
  {
    detail: "Normalize source files or pasted text, strip noise, and keep source references.",
    label: "Scrub",
  },
  {
    detail: "Generate draft artifacts from the selected pipeline and template.",
    label: "Generate",
  },
  {
    detail: "Run a separate verification pass against source material and product rules.",
    label: "Verify",
  },
  {
    detail: "Admin reviews diffs, confidence, missing sources, and product fit.",
    label: "Review",
  },
  {
    detail: "Publish only after explicit backend controls and audit history exist.",
    label: "Publish",
  },
];

export function findContentStudioPipeline(key: string) {
  return contentStudioPipelines.find((pipeline) => pipeline.key === key);
}

export function findContentStudioTemplate(
  pipelineKey: ContentStudioPipelineKey,
  templateKey: string,
) {
  return contentStudioTemplatesByPipeline[pipelineKey].find(
    (template) => template.value === templateKey,
  );
}
