/**
 * Which link lists the CampaignLinkPicker shows.
 *
 * The "link abaixo da imagem nos grupos" field must offer ONLY the WhatsApp
 * simulator links: form and landing-page links send people to a form, which is
 * not what a Post Grupos caption asks for.
 */

export type LinkSectionKey =
  | "disparopro"
  | "manual"
  | "forms"
  | "landing"
  | "simulator"
  | "groups"
  | "chat"
  | "courses";

export const ALL_LINK_SECTIONS: LinkSectionKey[] = [
  "disparopro",
  "manual",
  "forms",
  "landing",
  "simulator",
  "groups",
  "chat",
  "courses",
];

/** Sections offered when choosing the link that goes below the image in Post Grupos. */
export const GROUP_LINK_SECTIONS: LinkSectionKey[] = ["simulator"];

/** True only for the WhatsApp simulator short links. */
export function isSimulatorShortLink(link: { default_target: string }): boolean {
  return link.default_target === "whatsapp";
}

export function simulatorOnly<T extends { default_target: string }>(links: T[]): T[] {
  return links.filter(isSimulatorShortLink);
}

export interface SectionsToFetch {
  disparo: boolean;
  shortLinks: boolean;
  chat: boolean;
  courses: boolean;
  groups: boolean;
}

/** Which network calls a section selection actually needs. */
export function sectionsToFetch(sections: LinkSectionKey[]): SectionsToFetch {
  const has = (s: LinkSectionKey) => sections.includes(s);
  return {
    disparo: has("disparopro") || has("manual"),
    shortLinks: has("forms") || has("landing") || has("simulator"),
    chat: has("chat"),
    courses: has("courses"),
    groups: has("groups"),
  };
}
