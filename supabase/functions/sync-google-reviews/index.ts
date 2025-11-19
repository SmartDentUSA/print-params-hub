import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GoogleReview {
  author_name: string;
  author_url: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando sincronização de Google Reviews...');

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY não configurada');
    }

    // Buscar Place ID do banco
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: companyData, error: fetchError } = await supabaseClient
      .from('system_a_catalog')
      .select('id, extra_data')
      .eq('category', 'company_info')
      .eq('active', true)
      .single();

    if (fetchError) throw fetchError;

    const placeId = companyData?.extra_data?.google_place_id;
    if (!placeId) {
      throw new Error('google_place_id não configurado no banco. Configure em extra_data.google_place_id');
    }

    console.log(`📍 Place ID: ${placeId}`);

    // Buscar detalhes do Place (rating + reviews)
    const fields = 'name,rating,user_ratings_total,reviews';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=pt-BR`;

    console.log('🌐 Buscando reviews da API...');
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google API Error: ${data.status} - ${data.error_message || 'Erro desconhecido'}`);
    }

    const result = data.result;
    const reviews: GoogleReview[] = result.reviews || [];

    console.log(`✅ ${reviews.length} reviews obtidas`);

    // Atualizar banco
    const updatedExtraData = {
      ...companyData.extra_data,
      google_place_id: placeId,
      reviews_reputation: {
        ...companyData.extra_data?.reviews_reputation,
        google_rating: result.rating,
        google_review_count: result.user_ratings_total,
        google_reviews: reviews.map(r => ({
          author_name: r.author_name,
          author_url: r.author_url,
          profile_photo_url: r.profile_photo_url,
          rating: r.rating,
          relative_time_description: r.relative_time_description,
          text: r.text,
          time: r.time,
        })),
        last_synced_at: new Date().toISOString(),
      }
    };

    const { error: updateError } = await supabaseClient
      .from('system_a_catalog')
      .update({ 
        extra_data: updatedExtraData,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyData.id);

    if (updateError) throw updateError;

    console.log('💾 Reviews salvas no banco com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        rating: result.rating,
        review_count: result.user_ratings_total,
        reviews_synced: reviews.length,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
