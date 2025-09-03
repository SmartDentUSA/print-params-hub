import React, { createContext, useContext, ReactNode } from 'react';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { RealParameterSet } from '@/data/realData';

interface DataContextType {
  loading: boolean;
  error: string | null;
  insertParameterSets: (data: RealParameterSet[]) => Promise<boolean>;
  getUniqueBrands: () => Promise<any[]>;
  getModelsByBrand: (brandSlug: string) => Promise<any[]>;
  getResinsByModel: (modelSlug: string) => Promise<any[]>;
  clearError: () => void;
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
  const { 
    loading, 
    error, 
    insertParameterSets, 
    getUniqueBrands, 
    getModelsByBrand, 
    getResinsByModel, 
    clearError 
  } = useSupabaseData();

  return (
    <DataContext.Provider value={{
      loading,
      error,
      insertParameterSets,
      getUniqueBrands,
      getModelsByBrand,
      getResinsByModel,
      clearError
    }}>
      {children}
    </DataContext.Provider>
  );
};