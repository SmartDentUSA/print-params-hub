import ReactMarkdown from "react-markdown";

/**
 * Renderiza o corpo do contrato KOL (markdown) com estética de documento
 * formal no padrão ABNT: fonte serifada, texto justificado, título centrado,
 * cláusulas em destaque e espaçamento de documento jurídico.
 */
export function ContractDocument({ body }: { body: string }) {
  return (
    <div className="contract-doc bg-white text-slate-900 rounded-md border border-slate-200 shadow-sm px-8 py-10 sm:px-14 sm:py-12 font-serif text-[15px] leading-[1.9]">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="text-center font-bold uppercase tracking-wide text-base sm:text-lg mb-1 mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-bold uppercase text-[15px] mt-8 mb-3 text-slate-900">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-justify mb-3 indent-8">{children}</p>
          ),
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          hr: () => <hr className="my-8 border-slate-300" />,
          ul: ({ children }) => (
            <ul className="list-disc pl-10 mb-3 space-y-1 text-justify">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-10 mb-3 space-y-1 text-justify">{children}</ol>
          ),
          li: ({ children }) => <li className="text-justify">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-slate-300 pl-4 my-4 italic text-slate-700">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <table className="w-full border-collapse my-4 text-sm">{children}</table>
          ),
          th: ({ children }) => (
            <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-left font-bold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-300 px-3 py-2">{children}</td>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
