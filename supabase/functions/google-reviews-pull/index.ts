import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getValidAccessToken } from "../_shared/google-oauth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let newReviews = 0;
  let updated = 0;
  const errors: string[] = [];

  try {
    const accessToken = await getValidAccessToken();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 1) accounts
    const accResp = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: authHeaders });
    if (!accResp.ok) {
      const t = await accResp.text();
      throw new Error(`accounts ${accResp.status}: ${t}`);
    }
    const accJson = await accResp.json();
    const accounts: any[] = accJson.accounts ?? [];

    for (const account of accounts) {
      const accountName: string = account.name; // "accounts/123"

      // 2) locations
      const locResp = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress`,
        { headers: authHeaders },
      );
      if (!locResp.ok) {
        const t = await locResp.text();
        errors.push(`locations ${accountName} ${locResp.status}: ${t}`);
        continue;
      }
      const locJson = await locResp.json();
      const locations: any[] = locJson.locations ?? [];

      for (const location of locations) {
        const locName: string = location.name; // "locations/456"

        // 3) reviews (v4 endpoint)
        const reviewsResp = await fetch(
          `https://mybusiness.googleapis.com/v4/${accountName}/${locName}/reviews?pageSize=50&orderBy=updateTime desc`,
          { headers: authHeaders },
        );
        if (!reviewsResp.ok) {
          const t = await reviewsResp.text();
          errors.push(`reviews ${locName} ${reviewsResp.status}: ${t}`);
          continue;
        }
        const revJson = await reviewsResp.json();
        const reviews: any[] = revJson.reviews ?? [];

        for (const r of reviews) {
          const starMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
          const star = typeof r.starRating === "number" ? r.starRating : (starMap[r.starRating] ?? null);

          // try insert (UNIQUE on review_id)
          const { data: inserted, error: insErr } = await supabase
            .from("google_reviews")
            .insert({
              review_id: r.reviewId,
              account_id: accountName,
              location_id: locName,
              reviewer_name: r.reviewer?.displayName ?? null,
              reviewer_photo_url: r.reviewer?.profilePhotoUrl ?? null,
              star_rating: star,
              comment: r.comment ?? null,
              create_time: r.createTime ?? null,
              update_time: r.updateTime ?? null,
              reply_text: r.reviewReply?.comment ?? null,
              reply_time: r.reviewReply?.updateTime ?? null,
              response_status: r.reviewReply ? "published" : "pending",
            })
            .select("id, response_status")
            .maybeSingle();

          if (insErr) {
            // existing → check if reply changed on Google side
            if (insErr.code === "23505") {
              if (r.reviewReply?.comment) {
                const { data: existing } = await supabase
                  .from("google_reviews")
                  .select("id, reply_text")
                  .eq("review_id", r.reviewId)
                  .maybeSingle();
                if (existing && existing.reply_text !== r.reviewReply.comment) {
                  await supabase
                    .from("google_reviews")
                    .update({
                      reply_text: r.reviewReply.comment,
                      reply_time: r.reviewReply.updateTime ?? new Date().toISOString(),
                      response_status: "published",
                    })
                    .eq("id", existing.id);
                  updated++;
                }
              }
              continue;
            }
            errors.push(`insert ${r.reviewId}: ${insErr.message}`);
            continue;
          }

          if (inserted) {
            newReviews++;
            // se ainda não tem resposta no Google, dispara IA
            if (inserted.response_status === "pending") {
              // @ts-ignore Deno runtime
              EdgeRuntime.waitUntil(
                supabase.functions.invoke("google-reviews-respond", {
                  body: { review_id: inserted.id },
                }).catch((e) => console.error("[reviews-pull] invoke respond error", e)),
              );
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_reviews: newReviews, updated, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[google-reviews-pull] fatal", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message, new_reviews: newReviews, updated, errors }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});