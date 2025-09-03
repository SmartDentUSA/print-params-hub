import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useSupabaseData, Brand, Model, Resin, ParameterSet } from '@/hooks/useSupabaseData';
import { useSupabaseCRUD } from '@/hooks/useSupabaseCRUD';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { RealParameterSet } from '@/data/realData';

interface DataContextType {
  loading: boolean;
  error: string | null;
  fetchBrands: () => Promise<Brand[]>;
  fetchModelsByBrand: (brandSlug: string) => Promise<Model[]>;
  fetchParametersByModel: (modelSlug: string) => Promise<ParameterSet[]>;
  fetchAllModels: () => Promise<Model[]>;
  insertParameterSets: (data: RealParameterSet[]) => Promise<boolean>;
  getUniqueBrands: () => Promise<any[]>;
  getModelsByBrand: (brandSlug: string) => Promise<any[]>;
  getResinsByModel: (modelSlug: string) => Promise<any[]>;
  syncResinsFromParameters: () => Promise<boolean>;
  // CRUD operations
  insertBrand: (brand: Omit<Brand, 'id'>) => Promise<Brand | null>;
  updateBrand: (id: string, updates: Partial<Brand>) => Promise<Brand | null>;
  deleteBrand: (id: string) => Promise<boolean>;
  insertModel: (model: Omit<Model, 'id'>) => Promise<Model | null>;
  updateModel: (id: string, updates: Partial<Model>) => Promise<Model | null>;
  deleteModel: (id: string) => Promise<boolean>;
  insertResin: (resin: Omit<Resin, 'id'>) => Promise<Resin | null>;
  updateResin: (id: string, updates: Partial<Resin>) => Promise<Resin | null>;
  deleteResin: (id: string) => Promise<boolean>;
  insertParameterSet: (parameterSet: Omit<ParameterSet, 'id'>) => Promise<ParameterSet | null>;
  updateParameterSet: (id: string, updates: Partial<ParameterSet>) => Promise<ParameterSet | null>;
  deleteParameterSet: (id: string) => Promise<boolean>;
  clearError: () => void;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    console.error('useData called outside DataProvider context');
    console.error('Current context:', context);
    console.error('DataContext:', DataContext);
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  
  console.log('DataProvider rendering...');
  
  const dataHook = useSupabaseData();
  const crudHook = useSupabaseCRUD();
  
  console.log('DataProvider hooks loaded:', {
    dataHookLoading: dataHook.loading,
    crudHookLoading: crudHook.loading,
    dataHookError: dataHook.error,
    crudHookError: crudHook.error
  });
  
  // Initialize realtime updates
  useRealtimeUpdates();

  const value = {
    loading: dataHook.loading || crudHook.loading,
    error: dataHook.error || crudHook.error,
    fetchBrands: dataHook.fetchBrands,
    fetchModelsByBrand: dataHook.fetchModelsByBrand,
    fetchParametersByModel: dataHook.fetchParametersByModel,
    fetchAllModels: dataHook.fetchAllModels,
    insertParameterSets: dataHook.insertParameterSets,
    getUniqueBrands: dataHook.getUniqueBrands,
    getModelsByBrand: dataHook.getModelsByBrand,
    getResinsByModel: dataHook.getResinsByModel,
    syncResinsFromParameters: dataHook.syncResinsFromParameters,
    // CRUD operations
    insertBrand: crudHook.insertBrand,
    updateBrand: crudHook.updateBrand,
    deleteBrand: crudHook.deleteBrand,
    insertModel: crudHook.insertModel,
    updateModel: crudHook.updateModel,
    deleteModel: crudHook.deleteModel,
    insertResin: crudHook.insertResin,
    updateResin: crudHook.updateResin,
    deleteResin: crudHook.deleteResin,
    insertParameterSet: crudHook.insertParameterSet,
    updateParameterSet: crudHook.updateParameterSet,
    deleteParameterSet: crudHook.deleteParameterSet,
    clearError: () => {
      dataHook.clearError();
      crudHook.clearError();
    },
    refreshData: () => {
      console.log('Refreshing data...');
      // Force data refresh by clearing any cached data and reloading
      dataHook.clearError();
      crudHook.clearError();
      // Trigger a small delay then reload to ensure updates are visible
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  // Mark as initialized after first render
  useEffect(() => {
    setIsInitialized(true);
    console.log('DataProvider initialized');
  }, []);

  console.log('DataProvider providing context value:', value);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};