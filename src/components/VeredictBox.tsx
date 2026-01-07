import { CheckCircle2, AlertTriangle, Clock, Shield, FlaskConical, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface VeredictData {
  productName: string;
  veredict: 'approved' | 'approved_conditionally' | 'pending';
  summary: string;
  quickFacts: { label: string; value: string }[];
  testNorms?: string[];
}

interface VeredictBoxProps {
  data: VeredictData;
}

const veredictConfig = {
  approved: {
    icon: CheckCircle2,
    label: 'Aprovado',
    colorClass: 'veredict-approved',
    description: 'Aprovação Total'
  },
  approved_conditionally: {
    icon: AlertTriangle,
    label: 'Aprovado com Ressalvas',
    colorClass: 'veredict-conditional',
    description: 'Aprovação Condicional'
  },
  pending: {
    icon: Clock,
    label: 'Em Análise',
    colorClass: 'veredict-pending',
    description: 'Aguardando Resultado'
  }
};

export const VeredictBox = ({ data }: VeredictBoxProps) => {
  const config = veredictConfig[data.veredict];
  const IconComponent = config.icon;

  return (
    <section 
      className={`veredict-box ${config.colorClass}`}
      itemScope
      itemType="https://schema.org/DefinedTerm"
      data-featured-snippet="true"
      data-ai-summary="true"
      aria-label="Veredito de Segurança"
    >
      {/* Badge de Status */}
      <div className="veredict-header">
        <Badge className="veredict-badge" variant="default">
          <IconComponent className="w-4 h-4" />
          <span>{config.label}</span>
        </Badge>
        
        {data.testNorms && data.testNorms.length > 0 && (
          <div className="veredict-norms">
            <Shield className="w-4 h-4" />
            <span>{data.testNorms.join(' • ')}</span>
          </div>
        )}
      </div>

      {/* Produto e Resumo */}
      <div className="veredict-content">
        <h3 className="veredict-title" itemProp="name">
          <FlaskConical className="w-5 h-5" />
          Veredito de Segurança: {data.productName}
        </h3>
        <p className="veredict-summary" itemProp="description">
          {data.summary}
        </p>
      </div>

      {/* Quick Facts Grid */}
      {data.quickFacts && data.quickFacts.length > 0 && (
        <div className="veredict-facts">
          {data.quickFacts.map((fact, index) => (
            <div key={index} className="veredict-fact">
              <span className="veredict-fact-label">{fact.label}</span>
              <span className="veredict-fact-value">{fact.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Selo de autoridade */}
      <div className="veredict-footer">
        <Award className="w-4 h-4" />
        <span>Análise baseada em documentação técnica oficial</span>
      </div>
    </section>
  );
};
