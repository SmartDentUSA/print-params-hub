Plano para corrigir o SMS “enviado” que não chegou

1. Endurecer o Copilot contra sucesso inventado
- Em `smart-ops-copilot`, quando houver chamada de ferramenta de ação (`send_sms`, `send_whatsapp`, etc.), o backend não deixará mais o LLM escrever livremente a confirmação.
- Após executar a tool, o próprio servidor montará a resposta final com base no JSON real.
- Para SMS, só responderá “enviado” se `success: true`, `sent >= 1`, `failed = 0` e houver retorno real do provider.
- Se não houver tool executada em um pedido explícito de SMS, o Copilot responderá que o SMS não foi disparado, em vez de inventar status/ID.

2. Corrigir interpretação do DisparoPro
- Ajustar `smart-ops-sms-disparopro` para não tratar apenas HTTP 200 como entrega confirmada.
- Registrar e devolver campos reais do provider: status HTTP, corpo completo truncado, possível ID/protocolo real se existir.
- Se a API responder 200 mas sem confirmação rastreável, marcar como `accepted_unconfirmed` ou falha operacional, não como “entregue”.

3. Melhorar auditoria do envio
- Garantir que cada tentativa gere registro em `message_logs` com telefone normalizado, status do provider e erro/retorno bruto.
- Atualizar `campaign_sessions.results` com `provider_status`, `provider_response`, `sent`, `failed` e `per_lead`.
- Evitar IDs falsos como `cotacao-h3d4-2das`: o Copilot só poderá citar `campaign_id` interno ou ID retornado literalmente pela DisparoPro.

4. Validar o caso Danilo sem disparar outro SMS automático
- Consultar os registros recentes para o lead/email/telefone e confirmar se houve ou não tentativa real.
- Validar a função com uma chamada segura que não envie SMS real quando possível, ou com um payload inválido controlado para confirmar erro correto.
- Depois da implementação, o próximo envio real deve retornar uma mensagem objetiva: sucesso confirmado pelo provider ou falha com motivo real.