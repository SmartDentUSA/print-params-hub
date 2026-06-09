# Por que não está atualizando

Diagnóstico no banco:
- A turma "Teste — Turma 1" tem `enrolled_count = 0` (zero inscrições reais), `slots = 17` e nenhum dia em `smartops_turma_days` — os números mostrados estão corretos.
- O Realtime do Supabase está publicado para `smartops_courses`, `smartops_course_turmas` e `smartops_turma_days`.
- Já existe polling de 30s + invalidação ao voltar para a aba.

Causas prováveis de "não atualizar" na prática:
1. **Iframe embed em smartdent.com.br** — WebSocket do Realtime frequentemente falha dentro de iframe cross-origin e o navegador throttla `setInterval` quando a aba não está em foco.
2. **Cache do Vercel/CDN** no HTML de `/agenda` segurando o bundle antigo.
3. **Sem feedback visual** — o usuário não vê quando a página de fato refez o fetch, então parece "parada".

# O que vou fazer

Apenas em `src/pages/AgendaPublica.tsx` e `vercel.json` (frontend/edge — sem alterar banco):

1. **Polling mais agressivo**
   - Reduzir `refetchInterval` de 30s para **10s** nas duas queries (`public_agenda_turmas` e `public_agenda_courses`).
   - Manter `refetchIntervalInBackground: true` e `refetchOnWindowFocus: true`.

2. **Refresh manual visível**
   - Botão "Atualizar agora" no header, ao lado do indicador "Atualizado há Xs".
   - Indicador passa a mostrar também um spinner enquanto `isFetching`.

3. **Refresh por postMessage do pai (quando embed)**
   - Escutar `message` com `type: "smartdent:embed:treinamentos:refresh"` e invalidar queries — assim o site pai pode forçar atualização.

4. **Auto-refresh em foco da janela do iframe**
   - Adicionar listener `focus` além do `visibilitychange` (alguns navegadores não disparam visibility em iframes).

5. **Cache headers** em `vercel.json`
   - Adicionar bloco `headers` para `/agenda` com `Cache-Control: no-store, must-revalidate` garantindo que o HTML/bundle sempre revalide.

6. **Log de diagnóstico**
   - Console log no recebimento de eventos Realtime (`[agenda-realtime] payload`) para confirmar entrega quando o suporte precisar checar.

## O que NÃO vou tocar
- Schema do banco, triggers (`fn_sync_enrollment_count` já mantém `enrolled_count` correto).
- View `v_turmas_com_vagas`.
- Lógica de admin / criação de turmas.

## Como validar depois
- Abrir `/agenda` em uma aba, em outra aba inscrever um lead numa turma pública → contador "Inscritos" deve subir em até 10s sem reload.
- Clicar "Atualizar agora" força refetch imediato.
- No embed do site, parent pode enviar `postMessage({type:"smartdent:embed:treinamentos:refresh"}, "*")` para forçar.
