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
    <section className="faq-section my-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-3 mb-6">
        <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">
          ❓ Perguntas Frequentes
        </h2>
      </div>
      
      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={`faq-${index}`}
            value={`item-${index}`}
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-4 overflow-hidden"
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
