import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

interface KnowledgeFAQProps {
  faqs: FAQ[];
}

export function KnowledgeFAQ({ faqs }: KnowledgeFAQProps) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="faq-section mt-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-md">
      <div className="flex items-center gap-3 mb-6">
        <HelpCircle className="w-6 h-6 text-black dark:text-white" />
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Perguntas Frequentes
          </p>
          <h2 className="text-lg font-extrabold uppercase text-black dark:text-white m-0">
            FAQ
          </h2>
        </div>
      </div>
      
      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={`faq-${index}`}
            value={`item-${index}`}
            className="rounded-[20px] border-2 border-gray-200 dark:border-gray-700 px-4 overflow-hidden bg-white dark:bg-gray-900"
          >
            <AccordionTrigger className="text-left hover:no-underline py-4">
              <span className="font-semibold text-gray-900 dark:text-gray-100 pr-4">
                {faq.question}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300 pb-4">
              <div className="pt-2 leading-relaxed">
                {faq.answer}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
        💡 Essas perguntas são baseadas nas dúvidas mais comuns sobre o tema.
      </p>
    </section>
  );
}
