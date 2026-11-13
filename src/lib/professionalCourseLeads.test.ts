import { describe, expect, it } from "vitest";
import { groupCourseLeadRows } from "./professionalCourseLeads";

describe("groupCourseLeadRows", () => {
  it("soma leads e vendas de todos os cursos do mesmo profissional", () => {
    const out = groupCourseLeadRows([
      { professional_id: "p1", course_id: "c1", course_title: "A", leads: 26, won_leads: 2, won_deals: 2, won_value: "1116.2" },
      { professional_id: "p1", course_id: "c2", course_title: "B", leads: 4, won_leads: 1, won_deals: 1, won_value: 500 },
    ]);
    expect(out.p1.totals).toEqual({ leads: 30, wonLeads: 3, wonDeals: 3, wonValue: 1616.2 });
  });

  it("mantém profissionais separados", () => {
    const out = groupCourseLeadRows([
      { professional_id: "p1", course_id: "c1", course_title: "A", leads: 5, won_leads: 0, won_deals: 0, won_value: 0 },
      { professional_id: "p2", course_id: "c1", course_title: "A", leads: 5, won_leads: 0, won_deals: 0, won_value: 0 },
    ]);
    expect(out.p1.totals.leads).toBe(5);
    expect(out.p2.totals.leads).toBe(5);
  });
});
