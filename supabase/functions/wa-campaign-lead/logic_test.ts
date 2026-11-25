import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { campaignIntent, campaignSubmissionId, categoryMenu, selectedCategory, serviceWindowOpen } from '../_shared/wa-campaign-intent.ts';

Deno.test('WhatsApp: pedir informações entra no fluxo', () => {
  assertEquals(campaignIntent('eu quero uma informação'), 'information');
  assertEquals(campaignIntent('Gostaria de saber mais sobre a impressora e o mini vat'), 'information');
  assertEquals(campaignIntent('Tem resina com carga cerâmica ?'), 'information');
  assertEquals(campaignIntent('Gostaria de saber o preço das resinas para placa/carga ceramica e cera.'), 'information');
  assertEquals(campaignIntent('Eu gostaria de conhecer a qualidade antes de fazer o investimento'), 'information');
  assertEquals(campaignIntent('exoplan'), 'information');
  assertEquals(campaignIntent('Me passa os valores'), 'information');
  assertEquals(campaignIntent('Tenho interesse'), 'information');
  assertEquals(campaignIntent('Mais informações'), 'information');
});
Deno.test('WhatsApp: solicitação de contato entra no fluxo', () => {
  assertEquals(campaignIntent('Quero falar com um vendedor'), 'contact');
  assertEquals(campaignIntent('Pode me ligar?'), 'contact');
  assertEquals(campaignIntent('Entre em contato comigo'), 'contact');
  assertEquals(campaignIntent('Me chama por favor'), 'contact');
});
Deno.test('WhatsApp: cliques nos dois botões de interesse entram no fluxo', () => {
  assertEquals(campaignIntent('', 'Quero saber mais'), 'information');
  assertEquals(campaignIntent('', 'Falar com consultor'), 'contact');
});
Deno.test('WhatsApp: respostas automáticas não viram lead comercial', () => {
  assertEquals(campaignIntent('Clínica agradece seu contato. Como podemos ajudar?'), 'none');
  assertEquals(campaignIntent('Agradecemos sua mensagem. Não estamos disponíveis no momento, mas responderemos assim que possível.'), 'none');
  assertEquals(campaignIntent('Seja bem-vindo! Gostaria de saber seu nome para agendar sua consulta.'), 'none');
  assertEquals(campaignIntent('Nosso horário de atendimento é das 8h às 18h.'), 'none');
});
Deno.test('WhatsApp: SAIR e desinteresse não entram no fluxo', () => {
  assertEquals(campaignIntent('SAIR'), 'none');
  assertEquals(campaignIntent('Não quero receber mais informações'), 'none');
  assertEquals(campaignIntent('Não tenho interesse'), 'none');
  assertEquals(campaignIntent('', 'SAIR'), 'none');
});
Deno.test('WhatsApp: saudação e mensagem sem pedido não entram no fluxo', () => {
  assertEquals(campaignIntent('Bom dia'), 'none');
  assertEquals(campaignIntent('Oi'), 'none');
  assertEquals(campaignIntent('[Unsupported message]'), 'none');
});
Deno.test('WhatsApp: várias respostas na mesma campanha têm uma chave única', () => {
  assertEquals(campaignSubmissionId('campanha-1', '+5516998765432'), 'wa-campaign:campanha-1:+5516998765432');
  assertEquals(campaignSubmissionId('campanha-1', '551698765432'), campaignSubmissionId('campanha-1', '+5516998765432'));
  assertEquals(campaignSubmissionId('campanha-2', '+5516998765432') === campaignSubmissionId('campanha-1', '+5516998765432'), false);
});

Deno.test('WhatsApp: somente uma categoria realmente escolhida autoriza conversão', () => {
  const categories = [{ label: 'Resinas' }, { label: 'Scanner intraoral' }];
  const jobId = '11111111-1111-1111-1111-111111111111';
  assertEquals(selectedCategory(jobId, categories, 'Quero saber mais'), null);
  assertEquals(selectedCategory(jobId, categories, 'Falar com consultor'), null);
  assertEquals(selectedCategory(jobId, categories, `wa-interest:${jobId}:0`), 0);
  assertEquals(selectedCategory(jobId, categories, 'Scanner intraoral'), 1);
  assertEquals(selectedCategory(jobId, categories, 'wa-interest:22222222-2222-2222-2222-222222222222:0'), null);
  assertEquals(selectedCategory(jobId, categories, `wa-interest:${jobId}:2`), null);
});

Deno.test('WhatsApp: menu usa as categorias existentes e mantém identidade canônica', () => {
  const categories = [{ label: 'Resinas' }, { label: 'Impressora RayShape Edge Mini', product_name: 'Impressora 3D Rayshape Edge Mini' }];
  const rows = categoryMenu('11111111-1111-1111-1111-111111111111', categories).action.sections[0].rows;
  assertEquals(rows[0].title, 'Resinas');
  assertEquals(rows[1].title.length, 24);
  assertEquals(categories[1].product_name, 'Impressora 3D Rayshape Edge Mini');
});

Deno.test('WhatsApp: categoria não é enviada fora da janela de 24 horas', () => {
  const now = Date.parse('2026-11-25T23:00:00Z');
  assertEquals(serviceWindowOpen('2026-11-25T22:59:00Z', now), true);
  assertEquals(serviceWindowOpen('2026-11-24T23:00:00Z', now), false);
  assertEquals(serviceWindowOpen('2026-11-18T12:00:00Z', now), false);
});