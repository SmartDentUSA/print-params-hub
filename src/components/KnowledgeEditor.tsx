import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { 
  Bold, Italic, List, ListOrdered, Heading2, 
  Undo, Redo, Image as ImageIcon 
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { validateFileSize } from '@/utils/security';

interface KnowledgeEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
}

export function KnowledgeEditor({ content, onChange, placeholder, onEditorReady }: KnowledgeEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [altDialogOpen, setAltDialogOpen] = useState(false);
  const [altText, setAltText] = useState('');
  const [pendingImageUrl, setPendingImageUrl] = useState('');
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Desabilitar o link do StarterKit para evitar duplicação
        link: false,
      }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: placeholder || 'Escreva o conteúdo aqui...' })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sincronizar o editor quando o content prop mudar externamente
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Arquivo inválido', 
        description: 'Selecione uma imagem.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!validateFileSize(file, 10)) {
      toast({ 
        title: 'Imagem muito grande', 
        description: 'Máximo 10MB.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.split('.').pop();
      const path = `knowledge-content/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('model-images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('model-images')
        .getPublicUrl(path);

      // Ao invés de inserir direto, abrir dialog para alt text
      setPendingImageUrl(data.publicUrl);
      setAltDialogOpen(true);
      
      console.log('🖼️ Upload concluído:', {
        url: data.publicUrl,
        editorExists: !!editor,
        editorIsFocused: editor?.isFocused
      });
      console.log('📝 Modal aberto para alt text');
      
      toast({ 
        title: 'Upload concluído', 
        description: 'Agora adicione uma descrição para acessibilidade' 
      });
    } catch (err) {
      console.error(err);
      toast({ 
        title: 'Erro no upload', 
        description: 'Tente novamente.', 
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmAltText = () => {
    // Validação 1: Alt text
    if (!altText.trim() || altText.trim().length < 5) {
      toast({
        title: 'Alt text muito curto',
        description: 'Digite pelo menos 5 caracteres',
        variant: 'destructive'
      });
      return;
    }

    // Validação 2: Editor existe
    if (!editor) {
      toast({
        title: '❌ Editor não disponível',
        description: 'Recarregue a página e tente novamente',
        variant: 'destructive'
      });
      console.error('❌ Editor is null');
      return;
    }

    // Validação 3: URL da imagem existe
    if (!pendingImageUrl) {
      toast({
        title: '❌ URL da imagem não encontrada',
        description: 'Faça upload novamente',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Inserir imagem com alt text usando insertContent para não sobrescrever imagens existentes
      console.log('🖼️ Tentando inserir imagem:', pendingImageUrl);
      
      const pos = editor.state.selection.to;
      const chain = editor.chain().focus().setTextSelection(pos);
      
      chain.insertContent([
        { type: 'image', attrs: { src: pendingImageUrl, alt: altText.trim() } },
        { type: 'paragraph' }
      ]).run();

      // Forçar atualização do conteúdo
      const html = editor.getHTML();
      onChange(html);

      console.log('✅ Imagem inserida com sucesso');
      console.log('📄 HTML atualizado:', html.substring(0, 200));

      toast({ 
        title: '✅ Imagem inserida', 
        description: 'Clique no botão 🖼️ novamente para adicionar mais imagens!' 
      });

      // Limpar estados
      setAltDialogOpen(false);
      setAltText('');
      setPendingImageUrl('');
    } catch (error) {
      console.error('❌ Erro ao inserir imagem:', error);
      toast({
        title: '❌ Erro ao inserir imagem',
        description: 'Tente usar o botão "🔧 HTML" e inserir manualmente: <img src="URL" alt="descrição">',
        variant: 'destructive'
      });
    }
  };

  if (!editor) return null;

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <div className="w-px h-8 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Inserir imagem"
        >
          <ImageIcon className="w-4 h-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSelectImage}
        />
        <div className="w-px h-8 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Editor Area */}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-4 min-h-[400px] focus:outline-none"
      />
      </div>

      {/* Alt Text Dialog */}
      <Dialog open={altDialogOpen} onOpenChange={setAltDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descreva esta imagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Alt Text (mínimo 5 caracteres)</Label>
              <Input
                placeholder="Ex: Impressora 3D realizando calibração automática"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && altText.trim().length >= 5) {
                    handleConfirmAltText();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Descreva o conteúdo da imagem para melhorar acessibilidade e SEO
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleConfirmAltText}
                disabled={altText.trim().length < 5}
              >
                Confirmar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setAltDialogOpen(false);
                  setAltText('');
                  setPendingImageUrl('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
