import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  EMPTY_ECOMMERCE_FORM, applyEcommerceFilters, ecommerceFiltersToForm, ecommerceFormToFilters,
} from "./campaignEcommerceFilters";

function recorder() {
  const calls: Array<[string, ...any[]]> = [];
  const q: any = new Proxy({}, {
    get: (_t, prop: string) => (...args: any[]) => { calls.push([prop, ...args]); return q; },
  });
  return { q, calls };
}

const NOW = Date.parse("2026-11-16T12:00:00Z");

describe("segmentação E-commerce das campanhas", () => {
  test("sem nada escolhido não grava filtro nem altera a busca", () => {
    expect(ecommerceFormToFilters(EMPTY_ECOMMERCE_FORM)).toEqual({});
    const { q, calls } = recorder();
    applyEcommerceFilters(q, {}, NOW);
    expect(calls).toEqual([]);
  });

  test("produtos comprados: lead que comprou qualquer um dos escolhidos", () => {
    const { q, calls } = recorder();
    applyEcommerceFilters(q, { ecom_produtos: ["GlazeON - Splint", "SmartMake SHADE A"] }, NOW);
    expect(calls).toEqual([["overlaps", "lojaintegrada_produtos_comprados", ["GlazeON - Splint", "SmartMake SHADE A"]]]);
  });

  test("sem comprar há mais de 90 dias usa a data do último pedido", () => {
    const { q, calls } = recorder();
    applyEcommerceFilters(q, { ecom_ultima_compra: "gt_90" }, NOW);
    expect(calls).toEqual([["lt", "lojaintegrada_ultimo_pedido_data", "2026-08-18T12:00:00.000Z"]]);
  });

  test("comprou nos últimos 30 dias", () => {
    const { q, calls } = recorder();
    applyEcommerceFilters(q, { ecom_ultima_compra: "le_30" }, NOW);
    expect(calls).toEqual([["gte", "lojaintegrada_ultimo_pedido_data", "2026-10-17T12:00:00.000Z"]]);
  });

  test("total gasto entre mínimo e máximo", () => {
    const f = ecommerceFormToFilters({ ...EMPTY_ECOMMERCE_FORM, gastoMin: "1000", gastoMax: "5000" });
    expect(f).toEqual({ ecom_gasto_min: 1000, ecom_gasto_max: 5000 });
    const { q, calls } = recorder();
    applyEcommerceFilters(q, f, NOW);
    expect(calls).toEqual([["gte", "lojaintegrada_ltv", 1000], ["lte", "lojaintegrada_ltv", 5000]]);
  });

  test("nunca comprou exclui quem tem pedido, pedidos pagos ou valor gasto", () => {
    const { q, calls } = recorder();
    applyEcommerceFilters(q, { ecom_cliente: "no" }, NOW);
    expect(calls).toEqual([
      ["is", "lojaintegrada_ultimo_pedido_data", null],
      ["or", "lojaintegrada_total_pedidos_pagos.is.null,lojaintegrada_total_pedidos_pagos.eq.0"],
      ["or", "lojaintegrada_ltv.is.null,lojaintegrada_ltv.eq.0"],
    ]);
  });

  test("cupom: qualquer, nenhum ou código específico", () => {
    for (const [v, exp] of [
      ["any", ["not", "lojaintegrada_cupom_desconto", "is", null]],
      ["none", ["is", "lojaintegrada_cupom_desconto", null]],
      ["BLACKBD25", ["eq", "lojaintegrada_cupom_desconto", "BLACKBD25"]],
    ] as const) {
      const { q, calls } = recorder();
      applyEcommerceFilters(q, { ecom_cupom: v }, NOW);
      expect(calls).toEqual([exp as any]);
    }
  });

  test("segmentação salva volta igual para a tela", () => {
    const form = { ...EMPTY_ECOMMERCE_FORM, cliente: "yes", produtos: ["Visual Eyes"], pedidosMin: "2", ultimaCompra: "gt_180", tipoPessoa: "PJ" };
    expect(ecommerceFiltersToForm(ecommerceFormToFilters(form))).toEqual(form);
  });

  test("cópia do envio de e-mails é idêntica à da tela", () => {
    const strip = (s: string) => s.slice(s.indexOf("export type EcomRecency"));
    const a = readFileSync(new URL("./campaignEcommerceFilters.ts", import.meta.url), "utf8");
    const b = readFileSync(new URL("../../supabase/functions/_shared/campaign-ecommerce-filters.ts", import.meta.url), "utf8");
    expect(strip(b)).toBe(strip(a));
  });
});
