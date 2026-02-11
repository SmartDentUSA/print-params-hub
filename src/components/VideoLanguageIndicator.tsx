import { Globe, Volume2, Subtitles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';

interface AudioConfig {
  srclang: string;
  label: string;
  url: string;
}

interface SubtitleConfig {
  srclang: string;
  label: string;
  url: string;
}

interface VideoLanguageIndicatorProps {
  audios?: AudioConfig[];
  subtitles?: SubtitleConfig[];
}

const LANGUAGE_FLAGS: Record<string, string> = {
  'pt-BR': '🇧🇷',
  'pt': '🇧🇷',
  'en': '🇺🇸',
  'es': '🇪🇸',
};

const LANGUAGE_LABELS: Record<string, string> = {
  'pt-BR': 'Português',
  'pt': 'Português',
  'en': 'English',
  'es': 'Español',
};

export function VideoLanguageIndicator({ audios = [], subtitles = [] }: VideoLanguageIndicatorProps) {
  const { language, t } = useLanguage();

  if (audios.length === 0 && subtitles.length === 0) return null;

  // Normalizar language code (pt -> pt-BR)
  const normalizedUserLang = language === 'pt' ? 'pt-BR' : language;
  
  // Check if user's language has audio
  const hasAudioInUserLang = audios.some(
    audio => audio.srclang === normalizedUserLang || (audio.srclang && audio.srclang.startsWith(language))
  );

  // Check if user's language has subtitles
  const hasSubtitlesInUserLang = subtitles.some(
    sub => sub.srclang === normalizedUserLang || (sub.srclang && sub.srclang.startsWith(language))
  );

  // Determine message based on availability
  let message = '';
  if (hasAudioInUserLang) {
    message = t('knowledge.audio_available_your_language');
  } else if (hasSubtitlesInUserLang) {
    message = t('knowledge.subtitles_only_your_language');
  } else {
    message = t('knowledge.select_language_in_player');
  }

  return (
    <Alert className="bg-muted/30 border-border overflow-hidden">
      <Globe className="h-4 w-4 shrink-0" />
      <AlertDescription className="text-xs space-y-2 min-w-0">
        <div>{message}</div>
        
        <div className="flex flex-col gap-2 pt-1">
          {audios.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground mr-1">{t('knowledge.audio')}:</span>
              {audios.map((audio, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <span>{LANGUAGE_FLAGS[audio.srclang] || '🌐'}</span>
                  <span className="text-foreground font-medium">
                    {LANGUAGE_LABELS[audio.srclang] || audio.label}
                  </span>
                </span>
              )).reduce((prev, curr) => [prev, <span key="sep" className="text-muted-foreground">•</span>, curr] as any)}
            </div>
          )}

          {subtitles.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Subtitles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground mr-1">{t('knowledge.subtitles')}:</span>
              {subtitles.map((sub, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <span>{LANGUAGE_FLAGS[sub.srclang] || '🌐'}</span>
                  <span className="text-foreground font-medium">
                    {LANGUAGE_LABELS[sub.srclang] || sub.label}
                  </span>
                </span>
              )).reduce((prev, curr) => [prev, <span key="sep" className="text-muted-foreground">•</span>, curr] as any)}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
