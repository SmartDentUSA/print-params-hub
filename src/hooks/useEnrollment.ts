import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  SmartopsCourse, DealSearchResult, Turma, TurmaDay,
  EnrollmentCompanion, ProposalItem, EquipmentData,
} from '@/types/courses';
import { formatPhoneWaleads, EQUIP_CONFIG } from '@/lib/courseUtils';
import { buildTemplateVars, interpolateTemplate, DEFAULT_ENROLLMENT_TEMPLATE } from '@/lib/courseWhatsapp';
import type { EquipKey } from '@/types/courses';

interface EnrollParams {
  course: SmartopsCourse;
  dealResult: DealSearchResult;
  formData: {
    deal_title?: string; person_name: string; especialidade?: string;
    area_atuacao?: string; numero_contrato?: string;
    empresa_cnpj?: string; empresa_pais?: string; empresa_estado?: string;
    empresa_cidade?: string; empresa_endereco?: string; empresa_telefone?: string;
  };
  proposalItems: ProposalItem[];
  equipmentData: EquipmentData;
  selectedTurma: Turma;
  turmadays: TurmaDay[];
  companions: Partial<EnrollmentCompanion>[];
  notes?: string;
  instagram?: string;
  numero_proposta?: string;
  tipo_entrega?: 'enviar' | 'retirar';
  rastreamento?: string;
}

export function useEnrollment() {
  const qc        = useQueryClient();
  const { toast } = useToast();

  const enroll = async (p: EnrollParams): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const turmaSnapshot = {
        ...p.selectedTurma,
        days: [...p.turmadays].sort((a, b) => a.day_number - b.day_number),
      };

      // 1. INSERT enrollment
      const { data: enrollment, error: eEnroll } = await (supabase as any)
        .from('smartops_course_enrollments')
        .insert({
          course_id:               p.course.id,
          turma_id:                p.selectedTurma.id,
          turma_snapshot:          turmaSnapshot,
          lead_id:                 p.dealResult.lead_id,
          deal_id:                 p.dealResult.matched_deal.deal_id,
          deal_title:              p.formData.deal_title ?? p.dealResult.matched_deal.deal_title,
          deal_pipeline_name:      p.dealResult.matched_deal.pipeline_name,
          deal_value:              p.dealResult.matched_deal.value,
          person_name:             p.formData.person_name,
          person_piperun_id:       p.dealResult.pessoa_piperun_id,
          especialidade:           p.formData.especialidade,
          area_atuacao:            p.formData.area_atuacao,
          numero_contrato:         p.formData.numero_contrato,
          empresa_cnpj:            p.formData.empresa_cnpj,
          empresa_pais:            p.formData.empresa_pais,
          empresa_estado:          p.formData.empresa_estado,
          empresa_cidade:          p.formData.empresa_cidade,
          empresa_endereco:        p.formData.empresa_endereco,
          empresa_telefone:        p.formData.empresa_telefone,
          proposal_items_snapshot: p.proposalItems,
          equipment_data:          p.equipmentData,
          instagram:               p.instagram || null,
          numero_proposta:         p.numero_proposta || null,
          tipo_entrega:            p.tipo_entrega || null,
          rastreamento:            p.tipo_entrega === 'enviar' ? (p.rastreamento || null) : null,
          status:                  'agendado',
          enrolled_at:             new Date().toISOString(),
          notes:                   p.notes,
          created_by:              user.id,
        })
        .select('id').single();

      if (eEnroll) throw eEnroll;

      // 2. Companions (best-effort)
      const valid = p.companions.filter(c => c.name?.trim());
      if (valid.length > 0) {
        await (supabase as any).from('smartops_enrollment_companions')
          .insert(valid.map(c => ({ ...c, enrollment_id: enrollment.id })))
          .then(() => {}).catch((e: any) => console.warn('[companions]', e));
      }

      // 3. TAG SellFlux — assinatura exata: merge_tags_crm(p_lead_id, p_new_tags)
      const tag = p.selectedTurma.sellflux_tag || p.course.sellflux_campaign_tag;
      if (tag) {
        try {
          await supabase.rpc('merge_tags_crm' as any, {
            p_lead_id: p.dealResult.lead_id, p_new_tags: [tag],
          });
        } catch (e: any) { console.warn('[tags]', e); }
      }

      // 4. Kanban PipeRun (best-effort) — pipeline e stage dinamicos por curso
      if (p.dealResult.matched_deal.deal_id) {
        await supabase.functions.invoke('smart-ops-kanban-move', {
          body: {
            deal_id:           p.dealResult.matched_deal.deal_id,
            target_stage:      p.course.stage_after_enroll,
            pipeline_id:       p.course.pipeline_id_kanban,
            check_golden_rule: true,
          },
        }).catch((e: any) => console.warn('[kanban]', e));
      }

      // 5. Log de atividade — event_type (não activity_type)
      await (supabase as any).from('lead_activity_log').insert({
        lead_id: p.dealResult.lead_id, event_type: 'treinamento_agendado',
        entity_type: 'course_enrollment', entity_id: enrollment.id,
        entity_name: p.course.title,
        event_data: {
          course_id: p.course.id, turma_id: p.selectedTurma.id,
          turma_label: p.selectedTurma.label,
          start_date: turmaSnapshot.days[0]?.date,
          end_date: turmaSnapshot.days[turmaSnapshot.days.length - 1]?.date,
          deal_id: p.dealResult.matched_deal.deal_id,
        },
      }).then(() => {}).catch((e: any) => console.warn('[log]', e));

      // 6. Writeback seriais + instagram em lia_attendances (best-effort)
      await writebackEquipment(p.dealResult.lead_id, enrollment.id, p.equipmentData);
      if (p.instagram) {
        await (supabase as any).from('lia_attendances')
          .update({ instagram: p.instagram })
          .eq('id', p.dealResult.lead_id)
          .is('merged_into', null)
          .then(() => {}).catch((e: any) => console.warn('[instagram writeback]', e));
      }

      // 7. WhatsApp (best-effort)
      await sendEnrollmentWA({
        enrollmentId: enrollment.id, leadId: p.dealResult.lead_id,
        leadPhone: p.dealResult.telefone_normalized, personName: p.formData.person_name,
        course: p.course, turma: p.selectedTurma, days: p.turmadays, csEmail: user.email!,
      });

      qc.invalidateQueries({ queryKey: ['smartops_courses'] });
      qc.invalidateQueries({ queryKey: ['smartops_enrollments'] });
      qc.invalidateQueries({ queryKey: ['v_turmas_com_vagas'] });

      const noPhone = !p.dealResult.telefone_normalized ? ' · WA não enviado (sem telefone)' : '';
      toast({
        title: 'Agendamento confirmado!',
        description: `${p.formData.person_name} inscrito(a) na ${p.selectedTurma.label}${noPhone}`,
      });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao agendar', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  return { enroll };
}

async function writebackEquipment(
  leadId: string, enrollmentId: string, equipmentData: EquipmentData
) {
  try {
    const payload: Record<string, string> = {};
    for (const [rawKey, entry] of Object.entries(equipmentData)) {
      if (!entry) continue;
      // Toggle intraoral/bancada: equip_scanner com subtipo='bancada' -> equip_scanner_bancada
      let resolvedKey = rawKey as EquipKey;
      if (rawKey === 'equip_scanner' && entry.subtipo === 'bancada') {
        resolvedKey = 'equip_scanner_bancada';
      }
      const cfg = EQUIP_CONFIG[resolvedKey];
      if (!cfg) continue;
      if (entry.serial?.trim())    payload[cfg.lia_serial_field] = entry.serial.trim();
      if (entry.item_nome?.trim()) payload[cfg.lia_model_field]  = entry.item_nome.trim();
      if (entry.ativacao && cfg.lia_date_field) payload[cfg.lia_date_field] = entry.ativacao;
    }
    if (!Object.keys(payload).length) return;

    const { error } = await (supabase as any).from('lia_attendances')
      .update(payload).eq('id', leadId).is('merged_into', null); // OBRIGATORIO

    await (supabase as any).from('smartops_course_enrollments')
      .update(error
        ? { equip_writeback_error: error.message }
        : { equip_writeback_at: new Date().toISOString() })
      .eq('id', enrollmentId);
  } catch (e) { console.warn('[writeback]', e); }
}

async function sendEnrollmentWA(p: {
  enrollmentId: string; leadId: string; leadPhone?: string; personName: string;
  course: SmartopsCourse; turma: Turma; days: TurmaDay[]; csEmail: string;
}) {
  try {
    if (!p.leadPhone) return;
    const phone = formatPhoneWaleads(p.leadPhone);
    if (!phone) return;

    // CS por email — sem filtro de role (não existe role 'cs')
    const { data: cs } = await (supabase as any).from('team_members')
      .select('id, nome_completo, waleads_api_key')
      .eq('email', p.csEmail).eq('ativo', true).maybeSingle();
    if (!cs?.waleads_api_key) return;

    const template = p.course.whatsapp_message_template || DEFAULT_ENROLLMENT_TEMPLATE;
    const message  = interpolateTemplate(template,
      buildTemplateVars(p.course, p.turma, p.days, p.personName, cs.nome_completo));

    const { error } = await supabase.functions.invoke('smart-ops-send-waleads', {
      body: {
        to: phone, message, waleads_api_key: cs.waleads_api_key,
        lead_id: p.leadId, team_member_id: cs.id, source: 'enrollment_confirmation',
        metadata: { enrollment_id: p.enrollmentId, course_id: p.course.id, turma_id: p.turma.id },
      },
    });

    await (supabase as any).from('smartops_course_enrollments')
      .update(error ? { wa_error: String(error) } : { wa_sent_at: new Date().toISOString() })
      .eq('id', p.enrollmentId);
  } catch (e) { console.warn('[WA]', e); }
}
