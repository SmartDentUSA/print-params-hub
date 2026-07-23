import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Pencil, Plus, UserCircle } from "lucide-react";
import CoursesProfessionalProfile from "./CoursesProfessionalProfile";

type Professional = {
  id: string;
  nome: string | null;
  email: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  prof_photo_url: string | null;
  prof_cro: string | null;
  prof_course_platform: string | null;
  prof_updated_at: string | null;
};

export default function CoursesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, area_atuacao, especialidade, prof_photo_url, prof_cro, prof_course_platform, prof_updated_at")
        .not("prof_updated_at", "is", null)
        .is("merged_into", null)
        .order("prof_updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setProfessionals((data ?? []) as Professional[]);
    } catch (e: any) {
      toast({ title: "Erro ao carregar profissionais", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingEmail(undefined);
    setModalOpen(true);
  };

  const openEdit = (email: string | null) => {
    if (!email) return;
    setEditingEmail(email);
    setModalOpen(true);
  };

  const onSaved = () => {
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold">Cursos</h2>
            <p className="text-sm text-muted-foreground">Profissionais cadastrados e seus cursos</p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar profissional
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : professionals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum profissional cadastrado ainda. Clique em <strong>Adicionar profissional</strong> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden border shrink-0">
                    {p.prof_photo_url ? (
                      <img src={p.prof_photo_url} alt={p.nome ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.nome ?? "(sem nome)"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    {p.prof_cro && (
                      <div className="text-xs text-muted-foreground">CRO: {p.prof_cro}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {p.area_atuacao && <Badge variant="secondary" className="text-xs">{p.area_atuacao}</Badge>}
                  {p.especialidade && <Badge variant="outline" className="text-xs">{p.especialidade}</Badge>}
                  {p.prof_course_platform && <Badge variant="outline" className="text-xs">{p.prof_course_platform}</Badge>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p.email)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar perfil
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      toast({
                        title: "Em breve",
                        description: "Cadastro de cursos por profissional será liberado na próxima fase.",
                      })
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar curso
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmail ? "Editar profissional" : "Adicionar profissional"}</DialogTitle>
          </DialogHeader>
          <CoursesProfessionalProfile
            key={editingEmail ?? "new"}
            initialEmail={editingEmail}
            onSaved={onSaved}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}