import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  modelSlug: string;
  disabled?: boolean;
}

export function ImageUpload({ currentImageUrl, onImageUploaded, modelSlug, disabled }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${modelSlug}-${Date.now()}.${fileExt}`;
      const filePath = `models/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('model-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('model-images')
        .getPublicUrl(filePath);

      console.log('Image uploaded to storage. Public URL:', data.publicUrl);
      onImageUploaded(data.publicUrl);
      
      toast({
        title: "Sucesso",
        description: "Imagem enviada com sucesso!",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      uploadImage(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeImage = async () => {
    if (currentImageUrl) {
      onImageUploaded('');
      toast({
        title: "Sucesso",
        description: "Imagem removida.",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Imagem do Modelo
        </CardTitle>
        <CardDescription>
          Envie uma imagem para este modelo (máx. 5MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentImageUrl ? (
          <div className="space-y-4">
            <div className="relative">
              <img 
                src={currentImageUrl} 
                alt="Imagem atual" 
                className="w-full h-48 object-cover rounded-lg border"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={removeImage}
                disabled={disabled || uploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Enviando imagem...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique ou arraste uma imagem aqui
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="image-upload">Ou selecione um arquivo</Label>
          <Input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled || uploading}
            className="cursor-pointer"
          />
        </div>

        {!currentImageUrl && (
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Selecionar Imagem
          </Button>
        )}
      </CardContent>
    </Card>
  );
}