import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, UserPlus, Trash2, Edit, Shield, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserData {
  id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'author' | 'user';
  email_confirmed: boolean;
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'author' | 'user'>('user');
  const [isCreating, setIsCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{email: string, password: string} | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Get users from auth.users (this would need a server function in real implementation)
      // For now, we'll simulate with some data since we can't directly query auth.users
      const mockUsers: UserData[] = [
        {
          id: "089ab19a-83dd-45ca-94c8-8190d8403283",
          email: "danilohen@gmail.com",
          created_at: "2025-09-03T11:49:51.900912+00:00",
          role: 'admin',
          email_confirmed: true
        },
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "user@example.com", 
          created_at: "2025-09-01T10:30:00.000000+00:00",
          role: 'user',
          email_confirmed: true
        }
      ];
      
      setUsers(mockUsers);
    } catch (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha email e senha.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      
      // Chamar edge function para criar usuário
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole
        }
      });

      if (error) throw error;

      // Armazenar credenciais para mostrar ao admin
      setCreatedCredentials({
        email: data.credentials.email,
        password: data.credentials.password
      });
      
      toast({
        title: "Usuário criado com sucesso!",
        description: `${data.credentials.email} foi criado com a permissão de ${newUserRole}.`,
      });
      
      // Recarregar lista de usuários
      await loadUsers();
      
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Não foi possível criar o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'author' | 'user') => {
    try {
      // Update role in user_roles table
      const { error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          role: newRole 
        });

      if (error) throw error;

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: "Permissão atualizada",
        description: `Usuário agora tem permissão de ${newRole}.`,
      });
      
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast({
        title: "Erro ao atualizar permissão",
        description: "Não foi possível atualizar a permissão do usuário.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      toast({
        title: "Funcionalidade em desenvolvimento",
        description: "A remoção de usuários será implementada em breve.",
      });
    } catch (error) {
      toast({
        title: "Erro ao remover usuário",
        description: "Não foi possível remover o usuário.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando usuários...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border shadow-medium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gerenciamento de Usuários
              </CardTitle>
              <CardDescription>
                Gerencie usuários e suas permissões no sistema
              </CardDescription>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Adicionar Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    {createdCredentials ? (
                      "Usuário criado! Envie as credenciais abaixo manualmente ao novo usuário."
                    ) : (
                      "Crie uma nova conta de usuário no sistema"
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {createdCredentials ? (
                    <>
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        <div>
                          <Label className="text-sm font-semibold">Email:</Label>
                          <p className="text-sm font-mono">{createdCredentials.email}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-semibold">Senha:</Label>
                          <p className="text-sm font-mono">{createdCredentials.password}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ⚠️ Copie estas credenciais e envie manualmente ao usuário. Elas não serão exibidas novamente.
                      </p>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setCreatedCredentials(null);
                          setIsAddModalOpen(false);
                          setNewUserEmail("");
                          setNewUserPassword("");
                          setNewUserRole('user');
                        }}
                      >
                        Fechar
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="usuario@exemplo.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          disabled={isCreating}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Senha</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Senha segura"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          disabled={isCreating}
                        />
                      </div>
                      <div>
                        <Label htmlFor="role">Permissão</Label>
                        <Select 
                          value={newUserRole} 
                          onValueChange={(value: 'admin' | 'author' | 'user') => setNewUserRole(value)}
                          disabled={isCreating}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Usuário</SelectItem>
                            <SelectItem value="author">Autor</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsAddModalOpen(false);
                            setNewUserEmail("");
                            setNewUserPassword("");
                            setNewUserRole('user');
                          }}
                          disabled={isCreating}
                        >
                          Cancelar
                        </Button>
                        <Button onClick={handleAddUser} disabled={isCreating}>
                          {isCreating ? "Criando..." : "Criar Usuário"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : user.role === 'author' ? 'outline' : 'secondary'}>
                        {user.role === 'admin' ? (
                          <><Shield className="w-3 h-3 mr-1" /> Admin</>
                        ) : user.role === 'author' ? (
                          <><Edit className="w-3 h-3 mr-1" /> Autor</>
                        ) : (
                          <><User className="w-3 h-3 mr-1" /> Usuário</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.email_confirmed ? 'outline' : 'destructive'}>
                        {user.email_confirmed ? 'Confirmado' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog open={isEditModalOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                          if (!open) {
                            setIsEditModalOpen(false);
                            setSelectedUser(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsEditModalOpen(true);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Usuário</DialogTitle>
                              <DialogDescription>
                                Altere as permissões do usuário {user.email}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Permissão Atual</Label>
                                <Select 
                                  value={user.role} 
                                  onValueChange={(value: 'admin' | 'author' | 'user') => handleUpdateUserRole(user.id, value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">Usuário</SelectItem>
                                    <SelectItem value="author">Autor</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover o usuário {user.email}? 
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}