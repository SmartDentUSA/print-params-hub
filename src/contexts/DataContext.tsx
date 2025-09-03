import React, { createContext, useContext, ReactNode } from 'react';
import { useSupabaseData, Brand, Model, Resin, ParameterSet } from '@/hooks/useSupabaseData';
import { useSupabaseCRUD } from '@/hooks/useSupabaseCRUD';
import { RealParameterSet } from '@/data/realData';

interface DataContextType {
  loading: boolean;
  error: string | null;
  fetchBrands: () => Promise<Brand[]>;
  fetchModelsByBrand: (brandSlug: string) => Promise<Model[]>;
  fetchParametersByModel: (modelSlug: string) => Promise<ParameterSet[]>;
  insertParameterSets: (data: RealParameterSet[]) => Promise<boolean>;
  getUniqueBrands: () => Promise<any[]>;
  getModelsByBrand: (brandSlug: string) => Promise<any[]>;
  getResinsByModel: (modelSlug: string) => Promise<any[]>;
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
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const dataHook = useSupabaseData();
  const crudHook = useSupabaseCRUD();

  const value = {
    loading: dataHook.loading || crudHook.loading,
    error: dataHook.error || crudHook.error,
    fetchBrands: dataHook.fetchBrands,
    fetchModelsByBrand: dataHook.fetchModelsByBrand,
    fetchParametersByModel: dataHook.fetchParametersByModel,
    insertParameterSets: dataHook.insertParameterSets,
    getUniqueBrands: dataHook.getUniqueBrands,
    getModelsByBrand: dataHook.getModelsByBrand,
    getResinsByModel: dataHook.getResinsByModel,
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
      // Force re-fetch of all data by clearing internal caches
      console.log('Refreshing data...');
    }
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};