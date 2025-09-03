import React, { createContext, useContext, useState, ReactNode } from 'react';
import { RealParameterSet } from '@/data/realData';
import { realBrandsData } from '@/data/realData';

interface DataContextType {
  data: RealParameterSet[];
  setData: (data: RealParameterSet[]) => void;
  addData: (newData: RealParameterSet[]) => void;
  clearData: () => void;
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
  const [data, setDataState] = useState<RealParameterSet[]>(realBrandsData);

  const setData = (newData: RealParameterSet[]) => {
    setDataState(newData);
  };

  const addData = (newData: RealParameterSet[]) => {
    setDataState(prevData => [...prevData, ...newData]);
  };

  const clearData = () => {
    setDataState([]);
  };

  return (
    <DataContext.Provider value={{ data, setData, addData, clearData }}>
      {children}
    </DataContext.Provider>
  );
};