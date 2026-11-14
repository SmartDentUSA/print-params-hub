import { Link2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CampaignLinkPicker } from '@/components/smartops/CampaignLinkPicker';
import { GROUP_LINK_SECTIONS } from '@/lib/social/groupLinkSections';
import type { PostInput } from '@/lib/social/postSchema';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
  inputId: string;
}

/** Link encurtado que vai abaixo da imagem quando o post é enviado aos grupos de WhatsApp. */
export function GroupLinkField({ value, onChange, inputId }: Props) {
  const link = value.group_link_url ?? '';
  const valid = /^https?:\/\/\S+$/i.test(link.trim());
  const blastOff = value.group_blast_enabled === false;

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Link2 className="w-4 h-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1">
          <Label htmlFor={inputId} className="font-medium text-sm">Link abaixo da imagem nos grupos de WhatsApp (opcional)</Label>
          <div className="text-xs text-muted-foreground">
            Clique em <b>Links</b> para escolher um link do <b>simulador de WhatsApp</b>. No Post Grupos ele aparece logo abaixo da imagem.
          </div>
          {blastOff && (
            <div className="text-xs text-destructive mt-1">
              O envio automático aos grupos está desligado na etapa Agendamento.
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          placeholder="https://s.smartdent.com.br/..."
          value={link}
          onChange={(e) => onChange({ group_link_url: e.target.value })}
        />
        <CampaignLinkPicker
          channel="whatsapp_groups"
          sections={GROUP_LINK_SECTIONS}
          onInsert={(l) => onChange({ group_link_url: l.trim() })}
        />
        {link ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Remover link" onClick={() => onChange({ group_link_url: '' })}>
            <X className="w-4 h-4" />
          </Button>
        ) : null}
      </div>
      {link && !valid && <p className="text-xs text-destructive">Use um link começando com http:// ou https://</p>}
      {link && valid && (
        <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-line">
          {`Como fica no grupo:\n[imagem]\nResumo da legenda…\n\n👉 ${link.trim()}\n\n📲 Ver a publicação: (link do post)`}
        </div>
      )}
    </div>
  );
}
