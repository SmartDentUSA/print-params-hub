## Mudança (apenas `ShareButton` em `src/pages/AgendaPublica.tsx`)

Manter o mesmo template visual (`📚 / 🏷 / 👨‍🏫 / 📍 / 📅 / ⏰`) para os dois fluxos, mudando apenas a última linha conforme a modalidade da turma:

- **Presencial** (`turma.modality === "presencial"`):
  - Remover completamente a linha `Inscreva-se: ...`
  - Mensagem termina no cronograma

- **Online / Online ao vivo**:
  - Manter `Inscreva-se: ${url}` apontando para o forms público de inscrição:
    `https://parametros.smartdent.com.br/agenda/online?turma=${turma.id}`

Restante (emojis, cronograma, Web Share API + fallback `api.whatsapp.com/send`, encoding) permanece igual ao já planejado.

## Exemplo de saída

Presencial:
```
Opção de treinamento, aqui estão os detalhes:

📚 *Chairside Print - Odontologia Digital*
🏷 Turma: *146 BLZ ino 200 Dias 17,18,19/06*
👨‍🏫 Instrutor: Danilo Citigi e Livia Comar
📍 São Carlos/SP, na sede da Smart Dent

📅 17 de Jun de 2026 (Qua)
⏰ 08:30–17:30
```

Online:
```
Opção de treinamento, aqui estão os detalhes:

📚 *Curso X*
🏷 Turma: *Turma Y*
👨‍🏫 Instrutor: ...
📍 Online ao vivo

📅 ...
⏰ ...

Inscreva-se: https://parametros.smartdent.com.br/agenda/online?turma=...
```

## Escopo

100% frontend, isolado em `ShareButton`. Sem mudanças em backend, banco, ou no template do CS (`courseWhatsapp.ts`).
