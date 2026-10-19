export function postBinding(config: any) {
  const platformPostId = String(config.platform_post_id ?? "").trim();
  if ((config.keywords ?? []).length === 0 && !platformPostId) {
    throw new Error("Qualquer comentário exige um post específico");
  }
  return platformPostId ? { platformPostId, postTitle: config.post_title ?? "", alsoMatchInDms: false } : {};
}