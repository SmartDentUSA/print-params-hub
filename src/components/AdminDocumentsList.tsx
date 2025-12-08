import { useState } from 'react';
import { useAllDocuments, DOCUMENT_TYPES, LANGUAGES, DocumentSourceType } from '@/hooks/useAllDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  FileText, 
  ExternalLink, 
  Save, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingChanges {
  document_name?: string;
  document_description?: string;
  language?: string;
  document_category?: string;
  document_subcategory?: string;
  document_type?: string;
}

export default function AdminDocumentsList() {
  const {
    documents,
    loading,
    totalCount,
    page,
    setPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    languageFilter,
    setLanguageFilter,
    documentTypeFilter,
    setDocumentTypeFilter,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    categories,
    subcategories,
    stats,
    updateDocumentFields,
    refetch,
  } = useAllDocuments();

  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChanges>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const handleFieldChange = (docId: string, field: keyof PendingChanges, value: string) => {
    setPendingChanges(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (docId: string, sourceType: DocumentSourceType) => {
    const changes = pendingChanges[docId];
    if (!changes || Object.keys(changes).length === 0) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }

    setSavingIds(prev => new Set(prev).add(docId));
    
    const success = await updateDocumentFields(docId, sourceType, changes);
    
    if (success) {
      setPendingChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[docId];
        return newChanges;
      });
    }
    
    setSavingIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(docId);
      return newSet;
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">✅ Concluído</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-500 text-white">🔄 Processando</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Erro</Badge>;
      default:
        return <Badge variant="outline">⏳ Pendente</Badge>;
    }
  };

  const getSourceBadge = (sourceType: DocumentSourceType) => {
    return sourceType === 'resin' 
      ? <Badge variant="secondary" className="bg-purple-100 text-purple-700">Resina</Badge>
      : <Badge variant="secondary" className="bg-blue-100 text-blue-700">Catálogo</Badge>;
  };

  const getLanguageFlag = (lang: string) => {
    const langData = LANGUAGES.find(l => l.value === lang);
    return langData ? `${langData.flag} ${langData.value.toUpperCase()}` : lang;
  };

  const getCurrentValue = (docId: string, field: keyof PendingChanges, originalValue: string | null) => {
    return pendingChanges[docId]?.[field] ?? originalValue ?? '';
  };

  const hasChanges = (docId: string) => {
    return pendingChanges[docId] && Object.keys(pendingChanges[docId]).length > 0;
  };

  if (loading && documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            📄 Documentos do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            📄 Documentos do Sistema ({totalCount})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        
        {/* Stats */}
        <div className="flex flex-wrap gap-3 mt-4 text-sm">
          <Badge variant="outline" className="px-3 py-1">
            📊 Total: {stats.total}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-green-50 text-green-700">
            ✅ Extraídos: {stats.extracted}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-yellow-50 text-yellow-700">
            ⏳ Pendentes: {stats.pending}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-red-50 text-red-700">
            ❌ Erros: {stats.failed}
          </Badge>
          <span className="mx-2 text-muted-foreground">|</span>
          <Badge variant="outline" className="px-3 py-1">
            🇧🇷 {stats.pt}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            🇺🇸 {stats.en}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            🇪🇸 {stats.es}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="🌐 Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos idiomas</SelectItem>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.flag} {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="📄 Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {DOCUMENT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="📊 Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending">⏳ Pendente</SelectItem>
              <SelectItem value="processing">🔄 Processando</SelectItem>
              <SelectItem value="completed">✅ Concluído</SelectItem>
              <SelectItem value="failed">❌ Erro</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="🏷️ Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas fontes</SelectItem>
              <SelectItem value="resin">Resina</SelectItem>
              <SelectItem value="catalog">Catálogo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Nome</TableHead>
                <TableHead className="w-[200px]">Descrição</TableHead>
                <TableHead className="w-[100px]">🌐 Idioma</TableHead>
                <TableHead className="w-[140px]">Categoria</TableHead>
                <TableHead className="w-[140px]">Subcategoria</TableHead>
                <TableHead className="w-[180px]">Produto/Resina</TableHead>
                <TableHead className="w-[140px]">Tipo Doc</TableHead>
                <TableHead className="w-[100px]">Fonte</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id} className={hasChanges(doc.id) ? 'bg-yellow-50' : ''}>
                    {/* Nome */}
                    <TableCell>
                      <Input
                        value={getCurrentValue(doc.id, 'document_name', doc.document_name)}
                        onChange={(e) => handleFieldChange(doc.id, 'document_name', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    
                    {/* Descrição */}
                    <TableCell>
                      <Input
                        value={getCurrentValue(doc.id, 'document_description', doc.document_description)}
                        onChange={(e) => handleFieldChange(doc.id, 'document_description', e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Descrição..."
                      />
                    </TableCell>
                    
                    {/* Idioma */}
                    <TableCell>
                      <Select
                        value={getCurrentValue(doc.id, 'language', doc.language)}
                        onValueChange={(value) => handleFieldChange(doc.id, 'language', value)}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.flag} {lang.value.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    {/* Categoria */}
                    <TableCell>
                      <Select
                        value={getCurrentValue(doc.id, 'document_category', doc.document_category) || 'none'}
                        onValueChange={(value) => handleFieldChange(doc.id, 'document_category', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    {/* Subcategoria */}
                    <TableCell>
                      <Select
                        value={getCurrentValue(doc.id, 'document_subcategory', doc.document_subcategory) || 'none'}
                        onValueChange={(value) => handleFieldChange(doc.id, 'document_subcategory', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Subcat." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {subcategories.map(sub => (
                            <SelectItem key={sub.value} value={sub.value}>
                              {sub.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    {/* Produto/Resina vinculado */}
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{doc.linked_name || '—'}</span>
                        {doc.linked_category && (
                          <span className="block text-xs text-muted-foreground">
                            {doc.linked_category}
                            {doc.linked_subcategory && ` / ${doc.linked_subcategory}`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Tipo de Documento */}
                    <TableCell>
                      <Select
                        value={getCurrentValue(doc.id, 'document_type', doc.document_type) || 'none'}
                        onValueChange={(value) => handleFieldChange(doc.id, 'document_type', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {DOCUMENT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    {/* Fonte */}
                    <TableCell>
                      {getSourceBadge(doc.source_type)}
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      {getStatusBadge(doc.extraction_status)}
                    </TableCell>
                    
                    {/* Ações */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {hasChanges(doc.id) && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSave(doc.id, doc.source_type)}
                            disabled={savingIds.has(doc.id)}
                            className="h-8 px-2"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(doc.file_url, '_blank')}
                          className="h-8 px-2"
                          title="Abrir PDF"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages} ({totalCount} documentos)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
