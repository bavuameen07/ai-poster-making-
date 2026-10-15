import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/EditorShell";

export const metadata: Metadata = {
  title: "Poster Editor — Typeset Studio",
  description: "Design and export typography posters with editable text, fonts and AI assistance.",
};

export default function EditorPage({
  searchParams,
}: {
  searchParams: { template?: string };
}) {
  const template = typeof searchParams.template === "string" ? searchParams.template : undefined;
  return <EditorShell initialTemplateId={template} />;
}
