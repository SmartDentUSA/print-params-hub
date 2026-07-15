import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";

interface MarkdownElement {
  type: "section" | "subsection" | "note" | "bullet" | "subbullet";
  content: string;
  level?: number;
}

interface ParsedInstructions {
  pre: MarkdownElement[];
  post: MarkdownElement[];
  sections: { title: string; content: MarkdownElement[] }[];
}

export function parseMarkdownInstructions(
  instructions: string | null | undefined
): ParsedInstructions {
  if (!instructions) return { pre: [], post: [], sections: [] };

  const lines = instructions.split("\n");
  const pre: MarkdownElement[] = [];
  const post: MarkdownElement[] = [];
  const sections: { title: string; content: MarkdownElement[] }[] = [];
  let currentSection: "pre" | "post" | "generic" | null = null;
  let currentGenericTitle = "";
  let currentGenericContent: MarkdownElement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.match(/^##[^#]/)) {
      if (currentSection === "generic" && currentGenericContent.length > 0) {
        sections.push({ title: currentGenericTitle, content: currentGenericContent });
        currentGenericContent = [];
      }
      const sectionTitle = trimmed.replace(/^##\s*/, "");
      if (sectionTitle.match(/^PRÉ[-\s]?PROCESSAMENTO/i)) {
        currentSection = "pre";
        pre.push({ type: "section", content: sectionTitle });
      } else if (sectionTitle.match(/^PÓS[-\s]?PROCESSAMENTO/i)) {
        currentSection = "post";
        post.push({ type: "section", content: sectionTitle });
      } else {
        currentSection = "generic";
        currentGenericTitle = sectionTitle;
      }
      continue;
    }

    if (trimmed.match(/^###[^#]/)) {
      const subsection = trimmed.replace(/^###\s*/, "");
      if (currentSection === "pre") pre.push({ type: "subsection", content: subsection });
      if (currentSection === "post") post.push({ type: "subsection", content: subsection });
      if (currentSection === "generic")
        currentGenericContent.push({ type: "subsection", content: subsection });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const note = trimmed.replace(/^>\s*/, "");
      if (currentSection === "pre") pre.push({ type: "note", content: note });
      if (currentSection === "post") post.push({ type: "note", content: note });
      if (currentSection === "generic")
        currentGenericContent.push({ type: "note", content: note });
      continue;
    }

    if (trimmed.match(/^[•\-]\s+/)) {
      const bullet = trimmed.replace(/^[•\-]\s+/, "");
      const indentMatch = line.match(/^(\s+)/);
      const level = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
      const element: MarkdownElement = {
        type: level > 0 ? "subbullet" : "bullet",
        content: bullet,
        level,
      };
      if (currentSection === "pre") pre.push(element);
      if (currentSection === "post") post.push(element);
      if (currentSection === "generic") currentGenericContent.push(element);
      continue;
    }

    if (currentSection && trimmed) {
      const indentMatch = line.match(/^(\s+)/);
      const level = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
      const element: MarkdownElement = {
        type: level > 0 ? "subbullet" : "bullet",
        content: trimmed,
        level,
      };
      if (currentSection === "pre") pre.push(element);
      if (currentSection === "post") post.push(element);
      if (currentSection === "generic") currentGenericContent.push(element);
    }
  }

  if (currentSection === "generic" && currentGenericContent.length > 0) {
    sections.push({ title: currentGenericTitle, content: currentGenericContent });
  }

  return { pre, post, sections };
}

function linkifyProducts(text: string, productMap: Map<string, any>): JSX.Element[] {
  if (!text || productMap.size === 0) {
    return [<span key="plain">{text}</span>];
  }
  const productNames = Array.from(productMap.keys()).sort((a, b) => b.length - a.length);
  if (productNames.length === 0) return [<span key="plain">{text}</span>];
  const pattern = productNames
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    const normalizedPart = part.toLowerCase();
    const product = productMap.get(normalizedPart);
    if (product) {
      return (
        <a
          key={idx}
          href={product.shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 underline decoration-dotted underline-offset-2 transition-colors"
        >
          {product.name}
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function renderMarkdownElement(
  element: MarkdownElement,
  idx: number,
  productMap: Map<string, any>
): JSX.Element | null {
  const key = `element-${idx}`;
  switch (element.type) {
    case "section":
      return null;
    case "subsection":
      return (
        <h4
          key={key}
          className="text-sm font-bold text-foreground mt-4 mb-2 flex items-center gap-2 first:mt-0"
        >
          <span className="text-primary">🔹</span>
          {element.content}
        </h4>
      );
    case "note":
      return (
        <div
          key={key}
          className="my-2 p-3 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r"
        >
          <p className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <span className="text-lg shrink-0">⚠️</span>
            <span className="flex-1">{linkifyProducts(element.content, productMap)}</span>
          </p>
        </div>
      );
    case "bullet":
      return (
        <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="text-primary mt-1 shrink-0">•</span>
          <span className="flex-1">{linkifyProducts(element.content, productMap)}</span>
        </li>
      );
    case "subbullet": {
      const indent = (element.level || 1) * 16;
      return (
        <li
          key={key}
          className="flex items-start gap-2 text-sm text-muted-foreground"
          style={{ marginLeft: `${indent}px` }}
        >
          <span className="text-muted-foreground/60 mt-1 shrink-0">◦</span>
          <span className="flex-1">{linkifyProducts(element.content, productMap)}</span>
        </li>
      );
    }
    default:
      return null;
  }
}

interface ProcessingInstructionsViewProps {
  instructions: string | null | undefined;
  className?: string;
}

export function ProcessingInstructionsView({
  instructions,
  className,
}: ProcessingInstructionsViewProps) {
  const { products } = useCatalogProducts();
  const parsed = useMemo(() => parseMarkdownInstructions(instructions), [instructions]);

  if (!instructions) return null;

  const hasStructured =
    parsed.pre.length > 0 || parsed.post.length > 0 || parsed.sections.length > 0;

  if (!hasStructured) {
    return (
      <div
        className={className}
        style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, color: "#202124" }}
      >
        {instructions}
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "space-y-4 p-4 bg-muted/30 rounded-lg border border-border"
      }
    >
      {parsed.pre.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400">🔵</span>
            PRÉ-PROCESSAMENTO
          </h4>
          <ul className="space-y-1.5">
            {parsed.pre.map((element, idx) => renderMarkdownElement(element, idx, products))}
          </ul>
        </div>
      )}

      {parsed.post.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-green-600 dark:text-green-400">🟢</span>
            PÓS-PROCESSAMENTO
          </h4>
          <ul className="space-y-1.5">
            {parsed.post.map((element, idx) => renderMarkdownElement(element, idx, products))}
          </ul>
        </div>
      )}

      {parsed.sections.map((section, sectionIdx) => (
        <div key={`section-${sectionIdx}`}>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-purple-600 dark:text-purple-400">🟣</span>
            {section.title}
          </h4>
          <ul className="space-y-1.5">
            {section.content.map((element, idx) => renderMarkdownElement(element, idx, products))}
          </ul>
        </div>
      ))}
    </div>
  );
}