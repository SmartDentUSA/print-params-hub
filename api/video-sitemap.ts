export default async function handler(req: any, res: any) {
  try {
    const upstream = await fetch(
      'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/video-sitemap'
    );
    const xml = await upstream.text();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send('Error fetching sitemap');
  }
}
