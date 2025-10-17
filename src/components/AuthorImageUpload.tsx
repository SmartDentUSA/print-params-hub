import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, X, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthorImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  authorName: string;
  disabled?: boolean;
}

export function AuthorImageUpload({
  currentImageUrl,
  onImageUploaded,
  authorName,
  disabled = false
}: AuthorImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || '');
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem válida",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const slug = authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const fileName = `${slug}-${Date.now()}.${fileExt}`;
      const filePath = `authors/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('author-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('author-images')
        .getPublicUrl(filePath);

      setPreviewUrl(data.publicUrl);
      onImageUploaded(data.publicUrl);

      toast({
        title: "Sucesso",
        description: "Foto enviada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da foto",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl('');
    onImageUploaded('');
  };

  return (
    <div className="space-y-4">
      {previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
            onError={() => setPreviewUrl('')}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
          <UserCircle className="w-20 h-20 text-muted-foreground" />
        </div>
      )}

      <div>
        <input
          type="file"
          id="author-image-upload"
          className="hidden"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading || disabled}
        />
        <label htmlFor="author-image-upload">
          <Button
            type="button"
            variant="outline"
            disabled={uploading || disabled}
            asChild
          >
            <span className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Enviando...' : 'Selecionar Foto'}
            </span>
          </Button>
        </label>
        <p className="text-sm text-muted-foreground mt-2">
          Imagem circular • Máx. 5MB
        </p>
      </div>
    </div>
  );
}
