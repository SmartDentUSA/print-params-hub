import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useRealtimeUpdates = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Create a single channel for all table changes
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brands'
        },
        (payload) => {
          console.log('Brand change detected:', payload);
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Nova marca adicionada",
              description: `Marca ${payload.new.name} foi adicionada.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'models'
        },
        (payload) => {
          console.log('Model change detected:', payload);
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Novo modelo adicionado",
              description: `Modelo ${payload.new.name} foi adicionado.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'resins'
        },
        (payload) => {
          console.log('Resin change detected:', payload);
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Nova resina adicionada",
              description: `Resina ${payload.new.name} foi adicionada.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parameter_sets'
        },
        (payload) => {
          console.log('Parameter set change detected:', payload);
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Novos parâmetros adicionados",
              description: "Dados de impressão atualizados.",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
};