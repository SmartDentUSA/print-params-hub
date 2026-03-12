import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SupportCase {
  id: string;
  title: string;
  problem_description: string;
  failure_type: string;
  confidence: number;
  causes: string[];
  solutions: string[];
  image_urls: string[];
  tags: string[];
  brand_id: string | null;
  model_id: string | null;
  resin_id: string | null;
  workflow_scanners: string[];
  workflow_notebook: string | null;
  workflow_cad_softwares: string[];
  workflow_resins: string[];
  workflow_print_software: string[];
  workflow_printers: string[];
  workflow_print_accessories: string[];
  workflow_print_parts: string[];
  workflow_cure_equipment: string[];
  workflow_finishing: string[];
  workflow_final_equipment: string[];
  workflow_characterization: string[];
  workflow_installation: string[];
  workflow_dentistry_ortho: string[];
  workflow_lab_supplies: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export const FAILURE_TYPES = [
  { value: 'warping', label: 'Warping (Empenamento)' },
  { value: 'layer_shift', label: 'Layer Shift (Desalinhamento)' },
  { value: 'supports_failure', label: 'Falha de Suportes' },
  { value: 'undercuring', label: 'Undercuring (Subcura)' },
  { value: 'adhesion_failure', label: 'Falha de Adesão' },
  { value: 'dimensional_error', label: 'Erro Dimensional' },
  { value: 'surface_defect', label: 'Defeito de Superfície' },
  { value: 'other', label: 'Outro' },
];

export function useSupportCases() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchCases = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('support_cases')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching support cases:', error);
      toast({ title: 'Erro ao carregar casos', variant: 'destructive' });
    } else {
      setCases((data || []) as unknown as SupportCase[]);
    }
    setLoading(false);
  }, [statusFilter, toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const createCase = async (payload: Partial<SupportCase>) => {
    const { error } = await supabase.from('support_cases').insert(payload as any);
    if (error) {
      toast({ title: 'Erro ao criar caso', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Caso criado com sucesso' });
    fetchCases();
    return true;
  };

  const updateCase = async (id: string, updates: Partial<SupportCase>) => {
    const { error } = await supabase.from('support_cases').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar caso', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Caso atualizado' });
    fetchCases();
    return true;
  };

  const updateStatus = async (id: string, status: string) => {
    return updateCase(id, { status } as any);
  };

  const deleteCase = async (id: string) => {
    const { error } = await supabase.from('support_cases').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir caso', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Caso excluído' });
    fetchCases();
    return true;
  };

  const fetchBrands = async () => {
    const { data } = await supabase.from('brands').select('id, name').eq('active', true).order('name');
    return data || [];
  };

  const fetchModels = async (brandId?: string) => {
    let query = supabase.from('models').select('id, name, brand_id').eq('active', true).order('name');
    if (brandId) query = query.eq('brand_id', brandId);
    const { data } = await query;
    return data || [];
  };

  const fetchResins = async () => {
    const { data } = await supabase.from('resins').select('id, name, manufacturer').eq('active', true).order('name');
    return data || [];
  };

  const fetchProductsByCategory = async (category: string, subcategory?: string) => {
    let query = supabase
      .from('system_a_catalog')
      .select('id, name, product_category, product_subcategory')
      .eq('active', true)
      .eq('product_category', category)
      .order('name');
    if (subcategory) query = query.eq('product_subcategory', subcategory);
    const { data } = await query;
    return (data || []).map(d => ({ ...d, product_name: d.name })) as any[];
  };

  return {
    cases, loading, statusFilter, setStatusFilter,
    fetchCases, createCase, updateCase, updateStatus, deleteCase,
    fetchBrands, fetchModels, fetchResins, fetchProductsByCategory,
  };
}
