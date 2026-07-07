Ativar o flow "exocad RMS — Comment-to-DM" e alinhar sua representação no UI ao flow da Copa.

## Alterações em `social_flows` (id `4015e512-bd0b-4e04-bc04-e41c4f44ecde`)

1. `is_active = true`.
2. Preencher `zernio_automation_config` com o mesmo shape usado no flow da Copa (`type: comment_to_dm`) para o card renderizar igual:

```json
{
  "type": "comment_to_dm",
  "post_mode": "all_posts",
  "platform_post_id": null,
  "keywords": ["RMS", "rms"],
  "comment_reply": "Recebemos seu RMS! 🚀 Te chamei no Direct agora com todos os detalhes 📩",
  "dm_message": "Oi! Vi que você comentou RMS 🙌\n\nA exocad abriu uma oportunidade histórica no Brasil: DentalCAD Ultimate Lab Bundle sai de R$ 120.000 por R$ 2.390 (+ mensalidade de R$ 1.190).\n\nAcesse todos os detalhes e garanta sua vaga:\nhttps://s.smartdent.com.br/hxssbk",
  "short_link": "https://s.smartdent.com.br/hxssbk"
}
```

## O que NÃO muda

- `nodes` / `edges` permanecem como criados.
- `zernio_automation_id` fica `null` (o do Copa foi provisionado externamente). Se quiser que eu registre a automação no Zernio depois, é um passo separado.
- Nenhum outro flow é tocado.

## Como aplicar

Um único `UPDATE` na tabela `social_flows` filtrado pelo id acima.