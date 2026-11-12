# Criativos da campanha (Tabelas promocionais + Agenda)

## O que o usuário verá

**Tabelas promocionais → nova seção "Criativos da campanha"**
- Ao criar (ou abrir, se ainda não tiver) uma tabela promocional, o sistema cria uma pasta no Google Drive com o nome da tabela, dentro da pasta-mãe indicada (1za7m7FK1zzbncKw61Zz3D2fkx8RWdyFA), igual aos treinamentos.
- Botão para enviar imagens/vídeos direto para essa pasta, com campo **Descrição para uso** em cada criativo (editável, com opção de remover).
- Link "Abrir pasta no Drive".

**Agenda → botão "Criativos"** (ao lado de Tabela vigente, só equipe logada)
- Modal com os criativos da tabela vigente: miniatura, descrição para uso e botão **Download**.
- Em cada criativo, botão **Gerar mensagem para WhatsApp**: a IA olha a imagem e escreve uma mensagem de alta conversão com emojis. Campo editável + botão **Copiar**.
- Final fixo da mensagem, só quando o vendedor logado tem cupom ativo nessa tabela:
  ```text
  Para compras de resinas e insumos compre diretamente no site com desconto
  Utilizando o cupom: <CÓDIGO>
  Cupom válido até: <dd/mm/aaaa>
  Para equipamentos só me chamar!
  ```
  Sem cupom, a mensagem termina apenas com "Para equipamentos só me chamar!".
- Esse final é montado pelo sistema (não pela IA), para o cupom e a data sempre saírem certos.

## Detalhes técnicos
- Migração: `promotional_tables.drive_folder_id/drive_folder_url`; nova tabela `promotional_table_creatives` (table_id, drive_file_id, file_name, mime_type, thumbnail/storage path, description, sort_order, created_by) com GRANTs + RLS (admin/marketing editam; leitura via edge function).
- Edge `promo-creatives` (staff/admin): criar pasta (reusa `_shared/drive.ts`, conector Google Drive já usado pelos treinamentos), upload para a pasta, salvar descrição, remover. Cópia da miniatura no bucket `wa-media` para exibir sem depender de login no Drive.
- `crm-insercao`: nova ação `creatives` (membro de equipe resolvido server-side) retorna criativos da tabela vigente + cupons do vendedor; ação `creative_message` chama Lovable AI (modelo com visão, Gemini) com a imagem e anexa o rodapé de cupom de forma determinística (`creative-message.ts` + teste com cupom/sem cupom/data).
- Download pelo link do arquivo no Drive (ou pela cópia no armazenamento).
- Frontend: seção no editor de tabelas promocionais; `AgendaCreativesButton` + modal na Agenda.
- Se houver mais de um cupom ativo do vendedor, uso o de validade mais longa (confirmar).
