import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  getPokemonByGeneration: (generation: number) =>
    ipcRenderer.invoke('get-pokemon-by-generation', generation),

  getDatabaseStats: () =>
    ipcRenderer.invoke('get-database-stats'),

  searchPokemon: (query: string) =>
    ipcRenderer.invoke('search-pokemon', query),

  updatePokemonCollected: (pokemonId: number, collected: boolean) =>
    ipcRenderer.invoke('update-pokemon-collected', pokemonId, collected),

  updatePokemonPrice: (pokemonId: number, price: number) =>
    ipcRenderer.invoke('update-pokemon-price', pokemonId, price),

  updatePokemonUrl: (pokemonId: number, url: string) =>
    ipcRenderer.invoke('update-pokemon-url', pokemonId, url),

  addPurchase: (pokemonId: number, pokemonName: string, finalPrice: number, month: string) =>
    ipcRenderer.invoke('add-purchase', pokemonId, pokemonName, finalPrice, month),

  getPurchases: (sortBy?: string) =>
    ipcRenderer.invoke('get-purchases', sortBy),

  deletePurchase: (purchaseId: string) =>
    ipcRenderer.invoke('delete-purchase', purchaseId),

  deleteAllPurchases: () =>
    ipcRenderer.invoke('delete-all-purchases'),

  // Finances
  addTransaction: (transactionData: {
    type: 'income' | 'expense',
    category: string,
    description: string,
    amount: number,
    date: string
  }) => ipcRenderer.invoke('add-transaction', transactionData),

  getTransactions: (filters?: {
    sortBy?: string,
    category?: string,
    month?: string,
    type?: string
  }) => ipcRenderer.invoke('get-transactions', filters),

  deleteTransaction: (transactionId: string) =>
    ipcRenderer.invoke('delete-transaction', transactionId),

  getFinancialStats: (month?: string) =>
    ipcRenderer.invoke('get-financial-stats', month),

  getBudgetSettings: () =>
    ipcRenderer.invoke('get-budget-settings'),

  updateBudgetSettings: (settings: {
    monthlyBudget: number,
    percentages: { fisse: number, variabili: number, svago: number, risparmi: number }
  }) => ipcRenderer.invoke('update-budget-settings', settings),

  getHistoricalFinancialData: (monthsBack?: number) =>
    ipcRenderer.invoke('get-historical-financial-data', monthsBack),

  getSpendingInsights: () =>
    ipcRenderer.invoke('get-spending-insights'),

  // Scheduled Transactions
  addScheduledTransaction: (scheduledData: {
    type: 'income' | 'expense',
    category: string,
    description: string,
    amount: number,
    dayOfMonth: number
  }) => ipcRenderer.invoke('add-scheduled-transaction', scheduledData),

  getScheduledTransactions: () =>
    ipcRenderer.invoke('get-scheduled-transactions'),

  deleteScheduledTransaction: (transactionId: string) =>
    ipcRenderer.invoke('delete-scheduled-transaction', transactionId),

  processScheduledTransactions: () =>
    ipcRenderer.invoke('process-scheduled-transactions'),
});

declare global {
  interface Window {
    electronAPI: {
      openExternal: (url: string) => Promise<boolean>;
      getPokemonByGeneration: (generation: number) => Promise<any[]>;
      getDatabaseStats: () => Promise<{
        totalPokemon: number;
        collectedPokemon: number;
        remainingPokemon: number;
        connected: boolean
      }>;
      searchPokemon: (query: string) => Promise<any[]>;
      updatePokemonCollected: (pokemonId: number, collected: boolean) => Promise<boolean>;
      updatePokemonPrice: (pokemonId: number, price: number) => Promise<boolean>;
      updatePokemonUrl: (pokemonId: number, url: string) => Promise<boolean>;
      addPurchase: (pokemonId: number, pokemonName: string, finalPrice: number, month: string) => Promise<boolean>;
      getPurchases: (sortBy?: string) => Promise<any[]>;
      deletePurchase: (purchaseId: string) => Promise<boolean>;
      deleteAllPurchases: () => Promise<boolean>;
      // Finances
      addTransaction: (transactionData: {
        type: 'income' | 'expense',
        category: string,
        description: string,
        amount: number,
        date: string
      }) => Promise<boolean>;

      getTransactions: (filters?: {
        sortBy?: string,
        category?: string,
        month?: string,
        type?: string
      }) => Promise<any[]>;

      deleteTransaction: (transactionId: string) => Promise<boolean>;

      getFinancialStats: (month?: string) => Promise<{
        month: string,
        totalIncome: number,
        totalExpenses: number,
        netBalance: number,
        expensesByCategory: { fisse: number, variabili: number, svago: number, risparmi: number },
        transactionCount: number
      }>;

      getBudgetSettings: () => Promise<{
        monthlyBudget: number,
        percentages: { fisse: number, variabili: number, svago: number, risparmi: number }
      }>;

      updateBudgetSettings: (settings: {
        monthlyBudget: number,
        percentages: { fisse: number, variabili: number, svago: number, risparmi: number }
      }) => Promise<boolean>;

      getHistoricalFinancialData: (monthsBack?: number) => Promise<{
        [month: string]: {
          month: string,
          totalIncome: number,
          totalExpenses: number,
          netBalance: number,
          expensesByCategory: { fisse: number, variabili: number, svago: number, risparmi: number },
          transactionCount: number,
          savings: number,
          expensePercentages: { fisse: number, variabili: number, svago: number, risparmi: number }
        }
      }>;

      getSpendingInsights: () => Promise<{
        currentMonth: any,
        lastMonth: any,
        trends: any,
        insights: string[],
        comparisonMonth: string
      } | null>;

      // Scheduled Transactions
      addScheduledTransaction: (scheduledData: {
        type: 'income' | 'expense',
        category: string,
        description: string,
        amount: number,
        dayOfMonth: number
      }) => Promise<boolean>;

      getScheduledTransactions: () => Promise<Array<{
        _id: string,
        type: 'income' | 'expense',
        category: string,
        description: string,
        amount: number,
        dayOfMonth: number,
        isActive: boolean,
        createdAt: Date,
        updatedAt: Date,
        lastExecuted: Date | null
      }>>;

      deleteScheduledTransaction: (transactionId: string) => Promise<boolean>;

      processScheduledTransactions: () => Promise<{
        success: boolean,
        processedCount: number,
        message: string
      }>;
    };
  }
}