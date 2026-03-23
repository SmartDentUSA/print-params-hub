import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASTRON_BASE = "https://api.astronmembers.com.br/v1.0";

/* ─── Astron API helper (GET + Basic Auth) ─── */
async function astronFetch(endpoint: string, params: Record<string, string> = {}) {
  const amKey = Deno.env.get("ASTRON_AM_KEY")!;
  const amSecret = Deno.env.get("ASTRON_AM_SECRET")!;
  const clubId = Deno.env.get("ASTRON_CLUB_ID")!;

  const qs = new URLSearchParams({ club_id: clubId, ...params });
  const url = `${ASTRON_BASE}/${endpoint}?${qs}`;
  const auth = btoa(`${amKey}:${amSecret}`);

  console.log(`[sync-astron] GET ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Authorization": `Basic ${auth}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Astron ${endpoint} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/* ─── Phone normalizer ─── */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd >= 11) digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) return null;
  return `+55${digits}`;
}

/* ─── Generate login URL for a user ─── */
async function getLoginUrl(userId: string): Promise<string | null> {
  try {
    const resp = await astronFetch("generateClubUserLoginUrl", { user_id: userId });
    return resp?.login_url || resp?.url || null;
  } catch (e) {
    console.warn(`[sync-astron] Login URL fetch failed for user ${userId}: ${e}`);
    return null;
  }
}

/* ─── Fetch user courses with progress via API ─── */
async function getUserCourses(userId: string): Promise<{
  courses: Array<{
    course_id: string;
    course_name: string;
    percentage: number;
    completed_classes: number;
    total_classes: number;
    updated_at: string;
  }>;
  total: number;
  completed: number;
}> {
  const now = new Date().toISOString();
  try {
    const resp = await astronFetch("listClubUserCourses", { user_id: userId });
    const raw: any[] = resp?.data || resp?.courses || resp || [];

    if (!Array.isArray(raw) || raw.length === 0) {
      return { courses: [], total: 0, completed: 0 };
    }

    const courses = raw.map((c: any) => {
      const pct = Number(
        c.user_course_percentage ?? c.percentage ?? c.percentual_conclusao ?? c.progress ?? 0
      );
      const completedClasses = Number(
        c.user_course_completed_classes ?? c.completed_classes ?? c.aulas_concluidas ?? 0
      );
      const totalClasses = Number(
        c.course_total_classes ?? c.total_classes ?? c.total_aulas ?? 0
      );
      return {
        course_id: String(c.course_id ?? c.id ?? ""),
        course_name: String(c.course_name ?? c.name ?? c.nome ?? "Curso Astron"),
        percentage: pct,
        completed_classes: completedClasses,
        total_classes: totalClasses,
        updated_at: c.updated_at ?? c.change_time ?? now,
      };
    }).filter((c) => c.course_id !== "");

    const total = courses.length;
    const completed = courses.filter((c) => c.percentage >= 100).length;

    return { courses, total, completed };
  } catch (e) {
    console.warn(`[sync-astron] Courses fetch failed for user ${userId}: ${e}`);
    return { courses: [], total: 0, completed: 0 };
  }
}

/* ─── Upsert lead_course_progress for each course ─── */
async function upsertCourseProgress(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  courses: Array<{
    course_id: string;
    course_name: string;
    percentage: number;
    completed_classes: number;
    total_classes: number;
    updated_at: string;
  }>
): Promise<void> {
  const now = new Date().toISOString();
  for (const course of courses) {
    try {
      const isCompleted = course.percentage >= 100;
      const { data: existing } = await supabase
        .from("lead_course_progress")
        .select("id")
        .eq("lead_id", leadId)
        .eq("course_id", course.course_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("lead_course_progress").update({
          progress_pct: course.percentage,
          lessons_completed: course.completed_classes,
          lessons_total: course.total_classes,
          last_accessed_at: now,
          completed_at: isCompleted ? (course.updated_at ?? now) : null,
          status: isCompleted ? "completed" : "in_progress",
          updated_at: now,
        }).eq("id", existing.id);
      } else {
        await supabase.from("lead_course_progress").insert({
          lead_id: leadId,
          course_id: course.course_id,
          course_name: course.course_name,
          started_at: now,
          last_accessed_at: now,
          progress_pct: course.percentage,
          lessons_completed: course.completed_classes,
          lessons_total: course.total_classes,
          completed_at: isCompleted ? (course.updated_at ?? now) : null,
          status: isCompleted ? "completed" : "in_progress",
        });
      }
    } catch (e) {
      console.warn(`[sync-astron] lead_course_progress upsert failed for lead=${leadId} course=${course.course_id}: ${e}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional params
    let pageSize = 50; // API max is 50
    let maxPages = 50;
    let fetchCourses = true; // fetch per-course progress by default
    try {
      const body = await req.json();
      if (body.page_size) pageSize = Math.min(body.page_size, 50);
      if (body.max_pages) maxPages = Math.min(body.max_pages, 100);
      if (body.fetch_courses === false) fetchCourses = false;
    } catch { /* no body = defaults */ }

    let page = 1;
    let totalSynced = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalCoursesUpserted = 0;
    const errors: { email: string; error: string }[] = [];

    console.log(`[sync-astron] Starting sync (pageSize=${pageSize}, maxPages=${maxPages}, fetchCourses=${fetchCourses})`);

    while (page <= maxPages) {
      // 1. Fetch paginated users via API
      const usersResp = await astronFetch("listClubUsers", {
        page: String(page),
        limit: String(pageSize),
      });

      const users = usersResp?.data || usersResp?.users || usersResp || [];
      if (!Array.isArray(users) || users.length === 0) {
        console.log(`[sync-astron] No more users at page ${page}`);
        break;
      }

      console.log(`[sync-astron] Page ${page}: ${users.length} users`);

      for (const user of users) {
        try {
          const email = (user.email || "").trim().toLowerCase();
          if (!email || !email.includes("@")) continue;

          // 2. Fetch user plans via API
          let plansData: unknown[] = [];
          let plansActive: string[] = [];
          try {
            const plansResp = await astronFetch("listClubUserPlans", {
              user_id: String(user.id),
            });
            plansData = plansResp?.data || plansResp?.plans || plansResp || [];
            if (Array.isArray(plansData)) {
              plansActive = plansData
                .filter((p: any) => p.status === "active" || p.status === "ativo")
                .map((p: any) => p.plan_name || p.name || `Plan ${p.id}`);
            }
          } catch (e) {
            console.warn(`[sync-astron] Plans fetch failed for user ${user.id}: ${e}`);
          }

          // 3. Fetch per-course progress via API
          let coursesAccess: unknown[] = [];
          let coursesTotal = 0;
          let coursesCompleted = 0;

          if (fetchCourses) {
            const { courses, total, completed } = await getUserCourses(String(user.id));
            coursesAccess = courses;
            coursesTotal = total;
            coursesCompleted = completed;
          } else {
            // Fallback: use aggregate from user object (less accurate)
            coursesTotal = Number(user.courses_total ?? 0);
            coursesCompleted = Number(user.courses_completed ?? 0);
          }

          // 4. Generate login URL
          const loginUrl = await getLoginUrl(String(user.id));

          // 5. Build astron fields (correct schema, no legacy CSV fields)
          const astronFields: Record<string, unknown> = {
            astron_user_id: user.id,
            astron_status: user.status || "unknown",
            astron_nome: user.name || user.nome || null,
            astron_email: email,
            astron_phone: user.phone || user.telefone || null,
            astron_plans_active: plansActive,
            astron_plans_data: plansData,
            astron_courses_total: coursesTotal,
            astron_courses_completed: coursesCompleted,
            astron_login_url: loginUrl || `https://smartdentacademy.astronmembers.com/`,
            astron_created_at: user.created_at || null,
            astron_last_login_at: user.time_last_login || user.last_login_at || user.last_access || null,
            astron_synced_at: new Date().toISOString(),
          };

          // Only overwrite astron_courses_access if we actually got course data from API
          if (fetchCourses && coursesAccess.length > 0) {
            astronFields.astron_courses_access = coursesAccess;
          }

          // 6. Match by email in lia_attendances
          const { data: existing } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .limit(1)
            .maybeSingle();

          let leadId: string | null = null;

          if (existing) {
            const { error: updateErr } = await supabase
              .from("lia_attendances")
              .update(astronFields)
              .eq("id", existing.id);
            if (updateErr) throw updateErr;
            leadId = existing.id;
            totalUpdated++;
          } else {
            const phone = normalizePhone(user.phone || user.telefone);
            const { data: inserted, error: insertErr } = await supabase
              .from("lia_attendances")
              .insert({
                email,
                nome: user.name || user.nome || "Aluno Astron",
                source: "astron_members",
                telefone_normalized: phone,
                telefone_raw: user.phone || user.telefone || null,
                lead_status: "aluno",
                ...astronFields,
              })
              .select("id")
              .maybeSingle();

            if (insertErr) {
              if (insertErr.code === "23505") {
                const { data: conflicting } = await supabase
                  .from("lia_attendances")
                  .update(astronFields)
                  .eq("email", email)
                  .select("id")
                  .maybeSingle();
                leadId = conflicting?.id ?? null;
                totalUpdated++;
              } else {
                throw insertErr;
              }
            } else {
              leadId = inserted?.id ?? null;
              totalCreated++;
            }
          }

          // 7. Upsert lead_course_progress for each course
          if (leadId && fetchCourses && (coursesAccess as any[]).length > 0) {
            await upsertCourseProgress(supabase, leadId, coursesAccess as any[]);
            totalCoursesUpserted += (coursesAccess as any[]).length;
          }

          totalSynced++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ email: user.email || "unknown", error: msg });
        }
      }

      if (users.length < pageSize) break;
      page++;
    }

    console.log(`[sync-astron] Done: synced=${totalSynced}, created=${totalCreated}, updated=${totalUpdated}, coursesUpserted=${totalCoursesUpserted}, errors=${errors.length}`);

    return new Response(
      JSON.stringify({ synced: totalSynced, created: totalCreated, updated: totalUpdated, courses_upserted: totalCoursesUpserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync-astron] Fatal error: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
