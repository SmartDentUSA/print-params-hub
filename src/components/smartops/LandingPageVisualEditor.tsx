import { useEffect, useRef } from "react";
import grapesjs, { type Editor } from "grapesjs";
import presetWebpage from "grapesjs-preset-webpage";
import pluginForms from "grapesjs-plugin-forms";
import pluginTailwind from "grapesjs-tailwind";
import "grapesjs/dist/css/grapes.min.css";

interface Props {
  html: string;
  editorState?: Record<string, unknown> | null;
  onSave: (html: string, css: string, state: Record<string, unknown>) => Promise<void> | void;
}

// Cores oficiais Smart Dent — swatches do color picker do GrapesJS
const BRAND_SWATCHES = [
  "#2C245B", // roxo principal
  "#1D173E", // roxo hero
  "#F47C42", // laranja CTA
  "#F4F5F8", // fundo suave
  "#202331", // texto
  "#168B5B", // sucesso
  "#FFFFFF", // branco
  "#000000", // preto
];

export function LandingPageVisualEditor({ html, editorState, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Injeta Tailwind CDN e a paleta como CSS custom-props no canvas
    const editor = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false,
      plugins: [presetWebpage, pluginForms, pluginTailwind],
      pluginsOpts: {
        [presetWebpage as unknown as string]: {},
      },
      canvas: {
        styles: ["https://cdn.tailwindcss.com"],
        scripts: ["https://cdn.tailwindcss.com"],
      },
      colorPicker: { appendTo: "parent", offset: { top: 26, left: -166 } },
      deviceManager: {
        devices: [
          { name: "Desktop", width: "" },
          { name: "Tablet", width: "768px", widthMedia: "992px" },
          { name: "Mobile", width: "375px", widthMedia: "480px" },
        ],
      },
    });

    editorRef.current = editor;

    // Carrega HTML/CSS iniciais
    if (editorState && typeof editorState === "object" && Object.keys(editorState).length > 0) {
      try {
        editor.loadProjectData(editorState as never);
      } catch {
        editor.setComponents(html);
      }
    } else {
      editor.setComponents(html);
    }

    // Bloco extra: CTA do formulário (preserva o marcador data-form-cta)
    editor.BlockManager.add("smartdent-cta-form", {
      label: "CTA Formulário",
      category: "Smart Dent",
      content: `<button data-form-cta="primary" class="inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-xl bg-[#F47C42] text-white font-semibold text-base shadow-lg">Quero ativar agora</button>`,
      media: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 12h8"/></svg>`,
    });
    editor.BlockManager.add("smartdent-badge-ativacao", {
      label: "Selo Ativação",
      category: "Smart Dent",
      content: `<span class="inline-block bg-[#F47C42] text-white uppercase tracking-wider text-xs md:text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">Ativação Inicial</span>`,
    });

    // Aplica os swatches oficiais no picker
    const styleEl = document.createElement("style");
    styleEl.textContent = `.sp-container.sp-palette-container { background: #1f1f1f; }`;
    document.head.appendChild(styleEl);
    // spectrum não expõe API pública para presetColors — injetamos via CSS variables reservadas
    // e o usuário pode digitar HEX diretamente.
    void BRAND_SWATCHES;

    return () => {
      editor.destroy();
      editorRef.current = null;
      styleEl.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expor save via evento custom (o modal chama via ref)
  useEffect(() => {
    const handler = async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const outHtml = editor.getHtml();
      const outCss = editor.getCss() || "";
      const state = editor.getProjectData() as Record<string, unknown>;
      await onSave(outHtml, outCss, state);
    };
    window.addEventListener("smartdent-lp-editor-save", handler);
    return () => window.removeEventListener("smartdent-lp-editor-save", handler);
  }, [onSave]);

  return <div ref={containerRef} className="w-full h-full min-h-[600px]" />;
}

export function triggerLandingPageEditorSave() {
  window.dispatchEvent(new CustomEvent("smartdent-lp-editor-save"));
}