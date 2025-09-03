// Utility to clear all stored data
export const clearAllData = () => {
  // Clear localStorage data
  localStorage.removeItem('modelsWithImages');
  localStorage.removeItem('brandsData');
  localStorage.removeItem('resinsData');
  localStorage.removeItem('parametersData');
  
  console.log('All data cleared from localStorage');
  
  // Reload the page to reset state
  window.location.reload();
};