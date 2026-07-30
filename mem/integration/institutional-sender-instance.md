---
name: Instância institucional de envio
description: Todo envio institucional (briefing de vendedor, aviso de novos leads, broadcasts, sequências, relatório Sentinela) sai pela instância Evolution smartdent_marketing
type: feature
---
A instância "Danilo Henrique" (Danilo-Henrique) foi aposentada no Evolution.

Regra: TODO envio institucional do Sistema B usa a instância `smartdent_marketing`
com a apikey da própria linha `team_members.evolution_instance_name='smartdent_marketing'`
— nunca a instância/apikey do vendedor.

Aplicado em: smart-ops-lia-notify-seller (briefing/novos leads), sequence-runner,
wa-broadcast-dispatch, sentinela-daily-report, sentinela-webhook-receiver (fallback).

Exceções: conversas 1:1 de CS (`cs_principal`) e suporte (`Suporte_tecnico`) mantêm
suas próprias instâncias.
