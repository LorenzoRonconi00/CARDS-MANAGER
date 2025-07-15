import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://patatinaman:sY3frCAoyRHJ1noF@cluster0.leglybo.mongodb.net/';
const DATABASE_NAME = 'pokemon_collection';

let mainWindow: BrowserWindow;
let mongoClient: MongoClient;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));

    // Check scheduled transactions after window is created
    mainWindow.webContents.once('did-finish-load', () => {
        checkScheduledTransactions();
    });
}

// Connessione MongoDB
async function connectToDatabase() {
    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        console.log('✅ Connesso a MongoDB');
        return true;
    } catch (error) {
        console.error('❌ Errore connessione MongoDB:', error);
        return false;
    }
}

ipcMain.handle('open-external', async (_, url: string) => {
    try {
        console.log(`Tentativo apertura URL esterno: ${url}`);
        await shell.openExternal(url);
        console.log(`URL aperto con successo: ${url}`);
        return true;
    } catch (error) {
        console.error('Errore apertura URL esterno:', error);
        return false;
    }
});

// IPC Handlers
ipcMain.handle('get-pokemon-by-generation', async (_, generation: number) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('pokemon');

        const pokemon = await collection
            .find({ generation })
            .sort({ id: 1 })
            .toArray();

        return pokemon;
    } catch (error) {
        console.error('Errore nel recuperare Pokemon:', error);
        return [];
    }
});

ipcMain.handle('get-database-stats', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('pokemon');

        const totalCount = await collection.countDocuments();
        const collectedCount = await collection.countDocuments({ collected: true });
        const remainingCount = totalCount - collectedCount;

        return {
            totalPokemon: totalCount,
            collectedPokemon: collectedCount,
            remainingPokemon: remainingCount,
            connected: true
        };
    } catch (error) {
        console.error('Errore statistiche:', error);
        return {
            totalPokemon: 0,
            collectedPokemon: 0,
            remainingPokemon: 0,
            connected: false
        };
    }
});

// SEARCH
ipcMain.handle('search-pokemon', async (_, query: string) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('pokemon');

        // Cerca per numero se è un numero
        const numQuery = parseInt(query);
        let searchConditions = [];

        if (!isNaN(numQuery)) {
            searchConditions.push({ id: numQuery });
        }

        // Cerca per nome (case insensitive)
        searchConditions.push({
            name: { $regex: query, $options: 'i' }
        });

        const pokemon = await collection
            .find({ $or: searchConditions })
            .sort({ id: 1 })
            .toArray();

        return pokemon;
    } catch (error) {
        console.error('Errore ricerca Pokemon:', error);
        return [];
    }
});

// UPDATE
ipcMain.handle('update-pokemon-collected', async (_, pokemonId: number, collected: boolean) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('pokemon');

        const result = await collection.updateOne(
            { id: pokemonId },
            { $set: { collected: collected } }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error('Errore aggiornamento Pokemon:', error);
        return false;
    }
});

// UPDATE POKEMON-PRICE
ipcMain.handle('update-pokemon-price', async (_, pokemonId: number, price: number) => {
    try {
        console.log(`Tentativo aggiornamento prezzo Pokemon ${pokemonId}: €${price}`);

        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('pokemon');

        const result = await collection.updateOne(
            { id: pokemonId },
            { $set: { price: price } }
        );

        // Verifica se il documento è stato trovato E modificato
        const success = result.matchedCount > 0;

        return success;
    } catch (error) {
        console.error('Errore aggiornamento prezzo Pokemon:', error);
        return false;
    }
});

// UPDATE POKEMON URL
ipcMain.handle('update-pokemon-url', async (_, pokemonId: number, url: string) => {
    try {
        console.log(`Tentativo aggiornamento URL Pokemon ${pokemonId}: ${url}`);

        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('pokemon');

        const result = await collection.updateOne(
            { id: pokemonId },
            { $set: { url: url } }
        );

        const success = result.matchedCount > 0;
        return success;
    } catch (error) {
        console.error('Errore aggiornamento URL Pokemon:', error);
        return false;
    }
});

// Add purchase record
ipcMain.handle('add-purchase', async (_, pokemonId: number, pokemonName: string, finalPrice: number, month: string) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('purchases');

        const purchase = {
            pokemonId,
            pokemonName,
            finalPrice,
            month,
            date: new Date()
        };

        const result = await collection.insertOne(purchase);
        return result.insertedId ? true : false;
    } catch (error) {
        console.error('Errore aggiunta acquisto:', error);
        return false;
    }
});

// Get all purchases
ipcMain.handle('get-purchases', async (_, sortBy: string = 'date') => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('purchases');

        let sortOption = {};
        switch (sortBy) {
            case 'price-asc':
                sortOption = { finalPrice: 1 };
                break;
            case 'price-desc':
                sortOption = { finalPrice: -1 };
                break;
            case 'pokemon-id':
                sortOption = { pokemonId: 1 };
                break;
            default:
                sortOption = { date: -1 };
        }

        const purchases = await collection.find({}).sort(sortOption).toArray();

        // Converti _id in stringa per ogni acquisto
        const purchasesWithStringId = purchases.map(purchase => ({
            ...purchase,
            _id: purchase._id.toString()
        }));

        return purchasesWithStringId;
    } catch (error) {
        console.error('Errore recupero acquisti:', error);
        return [];
    }
});

// Delete purchase
ipcMain.handle('delete-purchase', async (_, purchaseId: string) => {
    try {
        // Valida che l'ID sia un ObjectId valido
        if (!ObjectId.isValid(purchaseId)) {
            console.error('ID ObjectId non valido:', purchaseId);
            return false;
        }

        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('purchases');

        const result = await collection.deleteOne({ _id: new ObjectId(purchaseId) });

        return result.deletedCount > 0;
    } catch (error) {
        console.error('Errore eliminazione acquisto server:', error);
        return false;
    }
});

// Delete all purchases
ipcMain.handle('delete-all-purchases', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('purchases');

        // Prima conta i documenti
        const count = await collection.countDocuments();

        if (count === 0) {
            return false; // Nessun documento da eliminare
        }

        const result = await collection.deleteMany({});
        console.log(`Eliminati ${result.deletedCount} acquisti`);

        return result.deletedCount > 0;
    } catch (error) {
        console.error('Errore eliminazione tutti acquisti:', error);
        return false;
    }
});

// Planned Purchases handlers
// Add planned purchase
ipcMain.handle('add-planned-purchase', async (_, plannedData: {
    pokemonId: number,
    pokemonName: string,
    basePrice: number,
    plannedDate: string
}) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('planned_purchases');

        const plannedPurchase = {
            pokemonId: plannedData.pokemonId,
            pokemonName: plannedData.pokemonName,
            basePrice: plannedData.basePrice,
            plannedDate: plannedData.plannedDate,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'pending' // pending, completed, cancelled
        };

        const result = await collection.insertOne(plannedPurchase);
        return result.insertedId ? true : false;
    } catch (error) {
        console.error('Errore aggiunta acquisto programmato:', error);
        return false;
    }
});

// Get all planned purchases grouped by date
ipcMain.handle('get-planned-purchases', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('planned_purchases');

        const plannedPurchases = await collection
            .find({ status: 'pending' })
            .sort({ plannedDate: 1 })
            .toArray();

        // Convert _id to string and group by date
        const groupedPurchases: { [date: string]: any[] } = {};

        plannedPurchases.forEach(purchase => {
            const purchaseWithStringId = {
                ...purchase,
                _id: purchase._id.toString()
            };

            const dateKey = purchase.plannedDate;
            if (!groupedPurchases[dateKey]) {
                groupedPurchases[dateKey] = [];
            }
            groupedPurchases[dateKey].push(purchaseWithStringId);
        });

        return groupedPurchases;
    } catch (error) {
        console.error('Errore recupero acquisti programmati:', error);
        return {};
    }
});

// Cancel planned purchases for a specific date
ipcMain.handle('cancel-planned-purchases', async (_, plannedDate: string) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('planned_purchases');

        const result = await collection.updateMany(
            { plannedDate: plannedDate, status: 'pending' },
            {
                $set: {
                    status: 'cancelled',
                    updatedAt: new Date()
                }
            }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error('Errore cancellazione acquisti programmati:', error);
        return false;
    }
});

// Complete planned purchases for a specific date
ipcMain.handle('complete-planned-purchases', async (_, data: {
    plannedDate: string,
    totalPrice: number,
    completionMonth: string
}) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const plannedCollection = db.collection('planned_purchases');
        const purchasesCollection = db.collection('purchases');

        // Get all pending purchases for this date
        const pendingPurchases = await plannedCollection
            .find({ plannedDate: data.plannedDate, status: 'pending' })
            .toArray();

        if (pendingPurchases.length === 0) {
            return { success: false, message: 'Nessun acquisto programmato trovato' };
        }

        // Calculate price per pokemon
        const pricePerPokemon = data.totalPrice / pendingPurchases.length;

        // Create actual purchases
        const purchasesToInsert = pendingPurchases.map(planned => ({
            pokemonId: planned.pokemonId,
            pokemonName: planned.pokemonName,
            finalPrice: pricePerPokemon,
            month: data.completionMonth,
            date: new Date(),
            wasPlanned: true,
            originalPlannedDate: planned.plannedDate
        }));

        // Insert purchases
        const insertResult = await purchasesCollection.insertMany(purchasesToInsert);

        if (insertResult.insertedCount > 0) {
            // Update planned purchases status
            await plannedCollection.updateMany(
                { plannedDate: data.plannedDate, status: 'pending' },
                {
                    $set: {
                        status: 'completed',
                        completionDate: new Date(),
                        finalPricePerItem: pricePerPokemon,
                        totalPrice: data.totalPrice,
                        updatedAt: new Date()
                    }
                }
            );

            return {
                success: true,
                message: `Completati ${insertResult.insertedCount} acquisti`,
                purchasesCreated: insertResult.insertedCount
            };
        }

        return { success: false, message: 'Errore durante la creazione degli acquisti' };
    } catch (error) {
        console.error('Errore completamento acquisti programmati:', error);
        return { success: false, message: 'Errore durante il completamento' };
    }
});

// Delete a single planned purchase
ipcMain.handle('delete-planned-purchase', async (_, purchaseId: string) => {
    try {
        if (!ObjectId.isValid(purchaseId)) {
            console.error('ID ObjectId non valido:', purchaseId);
            return false;
        }

        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('planned_purchases');

        const result = await collection.deleteOne({ _id: new ObjectId(purchaseId) });

        return result.deletedCount > 0;
    } catch (error) {
        console.error('Errore eliminazione acquisto programmato:', error);
        return false;
    }
});

// Check if a Pokemon is already planned for purchase
ipcMain.handle('check-pokemon-planned', async (_, pokemonId: number) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('planned_purchases');

        const count = await collection.countDocuments({
            pokemonId: pokemonId,
            status: 'pending'
        });

        return count > 0;
    } catch (error) {
        console.error('Errore controllo pokemon programmato:', error);
        return false;
    }
});

// Finances
// Add transaction
ipcMain.handle('add-transaction', async (_, transactionData: {
    type: 'income' | 'expense',
    category: string,
    description: string,
    amount: number,
    date: string
}) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('transactions');

        const transaction = {
            type: transactionData.type,
            category: transactionData.category,
            description: transactionData.description,
            amount: transactionData.amount,
            date: new Date(transactionData.date),
            month: transactionData.date.substring(0, 7), // "YYYY-MM"
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collection.insertOne(transaction);
        return result.insertedId ? true : false;
    } catch (error) {
        console.error('Errore aggiunta transazione:', error);
        return false;
    }
});

// Get all transactions
ipcMain.handle('get-transactions', async (_, filters?: {
    sortBy?: string,
    category?: string,
    month?: string,
    type?: string
}) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('transactions');

        // Build query
        let query: any = {};

        if (filters) {
            // Se filtro per categoria "income", filtriamo per type = 'income'
            if (filters.category === 'income') {
                query.type = 'income';
            }
            // Se filtro per altre categorie, filtriamo per category specifica E type = 'expense'
            else if (filters.category && filters.category !== 'all') {
                query.category = filters.category;
                query.type = 'expense';
            }

            if (filters.month) {
                query.month = filters.month;
            }

            // Non usiamo più filters.type perché è gestito dalla categoria
        }

        // Build sort
        let sortOption: any = { date: -1 }; // Default: newest first

        if (filters?.sortBy) {
            switch (filters.sortBy) {
                case 'amount-asc':
                    sortOption = { amount: 1 };
                    break;
                case 'amount-desc':
                    sortOption = { amount: -1 };
                    break;
                case 'category':
                    sortOption = { category: 1, date: -1 };
                    break;
                case 'date':
                default:
                    sortOption = { date: -1 };
            }
        }

        const transactions = await collection.find(query).sort(sortOption).toArray();

        // Convert _id to string
        const transactionsWithStringId = transactions.map(transaction => ({
            ...transaction,
            _id: transaction._id.toString()
        }));

        return transactionsWithStringId;
    } catch (error) {
        console.error('Errore recupero transazioni:', error);
        return [];
    }
});

// Delete transaction
ipcMain.handle('delete-transaction', async (_, transactionId: string) => {
    try {
        if (!ObjectId.isValid(transactionId)) {
            console.error('ID ObjectId non valido:', transactionId);
            return false;
        }

        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('transactions');

        const result = await collection.deleteOne({ _id: new ObjectId(transactionId) });

        return result.deletedCount > 0;
    } catch (error) {
        console.error('Errore eliminazione transazione:', error);
        return false;
    }
});

// Get financial stats for current month
ipcMain.handle('get-financial-stats', async (_, month?: string) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('transactions');

        // Use current month if not specified
        const targetMonth = month || new Date().toISOString().substring(0, 7);

        const transactions = await collection.find({ month: targetMonth }).toArray();

        // Calculate stats
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate expenses by category
        const expensesByCategory = {
            fisse: 0,
            variabili: 0,
            svago: 0,
            risparmi: 0
        };

        transactions
            .filter((t: any) => t.type === 'expense')
            .forEach((t: any) => {
                if (typeof t.category === 'string' && t.category in expensesByCategory) {
                    expensesByCategory[t.category as keyof typeof expensesByCategory] += t.amount;
                }
            });

        return {
            month: targetMonth,
            totalIncome: income,
            totalExpenses: expenses,
            netBalance: income - expenses,
            expensesByCategory,
            transactionCount: transactions.length
        };
    } catch (error) {
        console.error('Errore recupero statistiche finanziarie:', error);
        return {
            month: month || new Date().toISOString().substring(0, 7),
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            expensesByCategory: { fisse: 0, variabili: 0, svago: 0, risparmi: 0 },
            transactionCount: 0
        };
    }
});

// Get budget settings
ipcMain.handle('get-budget-settings', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('budget_settings');

        const settings = await collection.findOne({});

        // Return default settings if none found
        if (!settings) {
            return {
                monthlyBudget: 2500, // Default
                percentages: {
                    fisse: 40,
                    variabili: 30,
                    svago: 15,
                    risparmi: 15
                }
            };
        }

        return {
            monthlyBudget: settings.monthlyBudget,
            percentages: settings.percentages
        };
    } catch (error) {
        console.error('Errore recupero impostazioni budget:', error);
        return {
            monthlyBudget: 2500,
            percentages: { fisse: 40, variabili: 30, svago: 15, risparmi: 15 }
        };
    }
});

// Update budget settings
ipcMain.handle('update-budget-settings', async (_, settings: {
    monthlyBudget: number,
    percentages: { fisse: number, variabili: number, svago: number, risparmi: number }
}) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('budget_settings');

        const result = await collection.replaceOne(
            {}, // Match any document (since we only have one settings doc)
            {
                monthlyBudget: settings.monthlyBudget,
                percentages: settings.percentages,
                updatedAt: new Date()
            },
            { upsert: true } // Create if doesn't exist
        );

        return result.acknowledged;
    } catch (error) {
        console.error('Errore aggiornamento impostazioni budget:', error);
        return false;
    }
});

// Get historical financial data for multiple months
ipcMain.handle('get-historical-financial-data', async (_, monthsBack: number = 12) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('transactions');

        // Calculate months to analyze
        const currentDate = new Date();
        const months = [];

        for (let i = 0; i < monthsBack; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthString = date.toISOString().substring(0, 7);
            months.push(monthString);
        }

        // Get all transactions for these months
        const transactions = await collection.find({
            month: { $in: months }
        }).toArray();

        // Group by month and calculate stats
        const monthlyData: { [month: string]: any } = {};

        months.forEach(month => {
            const monthTransactions = transactions.filter(t => t.month === month);

            const income = monthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const expenses = monthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            // Calculate expenses by category
            const expensesByCategory = {
                fisse: 0,
                variabili: 0,
                svago: 0,
                risparmi: 0
            };

            monthTransactions
                .filter(t => t.type === 'expense')
                .forEach(t => {
                    if (expensesByCategory.hasOwnProperty(t.category)) {
                        expensesByCategory[t.category as keyof typeof expensesByCategory] += t.amount;
                    }
                });

            monthlyData[month] = {
                month,
                totalIncome: income,
                totalExpenses: expenses,
                netBalance: income - expenses,
                expensesByCategory,
                transactionCount: monthTransactions.length,
                savings: income - expenses, // Net savings for the month
                expensePercentages: income > 0 ? {
                    fisse: (expensesByCategory.fisse / income) * 100,
                    variabili: (expensesByCategory.variabili / income) * 100,
                    svago: (expensesByCategory.svago / income) * 100,
                    risparmi: (expensesByCategory.risparmi / income) * 100
                } : { fisse: 0, variabili: 0, svago: 0, risparmi: 0 }
            };
        });

        return monthlyData;
    } catch (error) {
        console.error('Errore recupero dati storici:', error);
        return {};
    }
});

// Get spending trends and insights
ipcMain.handle('get-spending-insights', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('transactions');

        const currentDate = new Date();
        const currentMonth = currentDate.toISOString().substring(0, 7);
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
            .toISOString().substring(0, 7);

        // Get current and last month data
        const [currentMonthTransactions, lastMonthTransactions] = await Promise.all([
            collection.find({ month: currentMonth }).toArray(),
            collection.find({ month: lastMonth }).toArray()
        ]);

        // Calculate current month stats
        const currentStats = calculateMonthStats(currentMonthTransactions);
        const lastStats = calculateMonthStats(lastMonthTransactions);

        // Calculate trends (percentage change)
        const trends = {
            income: calculatePercentageChange(lastStats.totalIncome, currentStats.totalIncome),
            expenses: calculatePercentageChange(lastStats.totalExpenses, currentStats.totalExpenses),
            savings: calculatePercentageChange(lastStats.netBalance, currentStats.netBalance),
            categoryTrends: {
                fisse: calculatePercentageChange(lastStats.expensesByCategory.fisse, currentStats.expensesByCategory.fisse),
                variabili: calculatePercentageChange(lastStats.expensesByCategory.variabili, currentStats.expensesByCategory.variabili),
                svago: calculatePercentageChange(lastStats.expensesByCategory.svago, currentStats.expensesByCategory.svago),
                risparmi: calculatePercentageChange(lastStats.expensesByCategory.risparmi, currentStats.expensesByCategory.risparmi)
            }
        };

        // Generate insights
        const insights = generateInsights(currentStats, lastStats, trends);

        return {
            currentMonth: currentStats,
            lastMonth: lastStats,
            trends,
            insights,
            comparisonMonth: lastMonth
        };
    } catch (error) {
        console.error('Errore generazione insights:', error);
        return null;
    }
});

// Scheduled Transactions handlers
// Add scheduled transaction
ipcMain.handle('add-scheduled-transaction', async (_, scheduledData: {
    type: 'income' | 'expense',
    category: string,
    description: string,
    amount: number,
    dayOfMonth: number
}) => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('scheduled_transactions');

        const scheduledTransaction = {
            type: scheduledData.type,
            category: scheduledData.category,
            description: scheduledData.description,
            amount: scheduledData.amount,
            dayOfMonth: scheduledData.dayOfMonth,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastExecuted: null
        };

        const result = await collection.insertOne(scheduledTransaction);
        return result.insertedId ? true : false;
    } catch (error) {
        console.error('Errore aggiunta transazione programmata:', error);
        return false;
    }
});

// Get all scheduled transactions
ipcMain.handle('get-scheduled-transactions', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('scheduled_transactions');

        const scheduledTransactions = await collection.find({ isActive: true }).toArray();

        // Convert _id to string
        const transactionsWithStringId = scheduledTransactions.map(transaction => ({
            ...transaction,
            _id: transaction._id.toString()
        }));

        return transactionsWithStringId;
    } catch (error) {
        console.error('Errore recupero transazioni programmate:', error);
        return [];
    }
});

// Delete scheduled transaction
ipcMain.handle('delete-scheduled-transaction', async (_, transactionId: string) => {
    try {
        if (!ObjectId.isValid(transactionId)) {
            console.error('ID ObjectId non valido:', transactionId);
            return false;
        }

        const db = mongoClient.db(DATABASE_NAME);
        const collection = db.collection('scheduled_transactions');

        // Instead of deleting, we mark it as inactive
        const result = await collection.updateOne(
            { _id: new ObjectId(transactionId) },
            { $set: { isActive: false, updatedAt: new Date() } }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error('Errore eliminazione transazione programmata:', error);
        return false;
    }
});

// Process scheduled transactions for today
ipcMain.handle('process-scheduled-transactions', async () => {
    try {
        const db = mongoClient.db(DATABASE_NAME);
        const scheduledCollection = db.collection('scheduled_transactions');
        const transactionsCollection = db.collection('transactions');

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.toISOString().substring(0, 7);

        // Get all active scheduled transactions for today
        const scheduledTransactions = await scheduledCollection.find({
            isActive: true,
            dayOfMonth: currentDay
        }).toArray();

        let processedCount = 0;

        for (const scheduled of scheduledTransactions) {
            // Check if we already executed this scheduled transaction this month
            const lastExecutedMonth = scheduled.lastExecuted
                ? new Date(scheduled.lastExecuted).toISOString().substring(0, 7)
                : null;

            if (lastExecutedMonth === currentMonth) {
                console.log(`Transazione programmata già eseguita questo mese: ${scheduled.description}`);
                continue;
            }

            // Create the actual transaction
            const transaction = {
                type: scheduled.type,
                category: scheduled.category,
                description: scheduled.description,
                amount: scheduled.amount,
                date: today,
                month: currentMonth,
                createdAt: new Date(),
                updatedAt: new Date(),
                isScheduled: true,
                scheduledTransactionId: scheduled._id
            };

            const result = await transactionsCollection.insertOne(transaction);

            if (result.insertedId) {
                // Update the scheduled transaction with last executed date
                await scheduledCollection.updateOne(
                    { _id: scheduled._id },
                    { $set: { lastExecuted: today } }
                );
                processedCount++;
                console.log(`Eseguita transazione programmata: ${scheduled.description}`);
            }
        }

        return {
            success: true,
            processedCount,
            message: `Elaborate ${processedCount} transazioni programmate`
        };
    } catch (error) {
        console.error('Errore elaborazione transazioni programmate:', error);
        return {
            success: false,
            processedCount: 0,
            message: 'Errore durante l\'elaborazione'
        };
    }
});

// Helper functions
function calculateMonthStats(transactions: any[]) {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    const expensesByCategory = {
        fisse: 0,
        variabili: 0,
        svago: 0,
        risparmi: 0
    };

    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            if (expensesByCategory.hasOwnProperty(t.category)) {
                expensesByCategory[t.category as keyof typeof expensesByCategory] += t.amount;
            }
        });

    return {
        totalIncome: income,
        totalExpenses: expenses,
        netBalance: income - expenses,
        expensesByCategory,
        transactionCount: transactions.length
    };
}

function calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
}

function generateInsights(current: any, last: any, trends: any): string[] {
    const insights = [];

    // Income insights
    if (trends.income > 10) {
        insights.push(`💰 Le tue entrate sono aumentate del ${trends.income.toFixed(1)}% rispetto al mese scorso!`);
    } else if (trends.income < -10) {
        insights.push(`📉 Le tue entrate sono diminuite del ${Math.abs(trends.income).toFixed(1)}% rispetto al mese scorso.`);
    }

    // Savings insights
    if (trends.savings > 20) {
        insights.push(`🎯 Ottimo! Hai risparmiato il ${trends.savings.toFixed(1)}% in più rispetto al mese scorso.`);
    } else if (trends.savings < -20) {
        insights.push(`⚠️ I tuoi risparmi sono diminuiti del ${Math.abs(trends.savings).toFixed(1)}% rispetto al mese scorso.`);
    }

    // Category insights
    Object.entries(trends.categoryTrends).forEach(([category, trend]: [string, any]) => {
        if (trend > 30) {
            const categoryName = getCategoryName(category);
            insights.push(`📈 Attenzione: le spese per ${categoryName} sono aumentate del ${trend.toFixed(1)}%.`);
        }
    });

    // Budget adherence insights
    const budgetPercentages = { fisse: 40, variabili: 30, svago: 15, risparmi: 15 };
    if (current.totalIncome > 0) {
        Object.entries(current.expensesByCategory).forEach(([category, amount]: [string, any]) => {
            const percentage = (amount / current.totalIncome) * 100;
            const targetPercentage = budgetPercentages[category as keyof typeof budgetPercentages];

            if (percentage > targetPercentage * 1.2) { // 20% over budget
                const categoryName = getCategoryName(category);
                insights.push(`🚨 Hai sforato il budget per ${categoryName}: ${percentage.toFixed(1)}% vs ${targetPercentage}% target.`);
            }
        });
    }

    return insights.length > 0 ? insights : ['📊 Questo mese non ci sono attivitá.'];
}

function getCategoryName(category: string): string {
    const names = {
        fisse: 'Spese Fisse',
        variabili: 'Spese Variabili',
        svago: 'Spese Svago',
        risparmi: 'Risparmi'
    };
    return names[category as keyof typeof names] || category;
}

// Function to check and process scheduled transactions on app start
async function checkScheduledTransactions() {
    try {
        const result = await processScheduledTransactions();
        console.log('Check transazioni programmate:', result.message);
    } catch (error) {
        console.error('Errore check transazioni programmate:', error);
    }
}

// Helper function for processing scheduled transactions (used by IPC handler)
async function processScheduledTransactions() {
    const db = mongoClient.db(DATABASE_NAME);
    const scheduledCollection = db.collection('scheduled_transactions');
    const transactionsCollection = db.collection('transactions');

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.toISOString().substring(0, 7);

    const scheduledTransactions = await scheduledCollection.find({
        isActive: true,
        dayOfMonth: currentDay
    }).toArray();

    let processedCount = 0;

    for (const scheduled of scheduledTransactions) {
        const lastExecutedMonth = scheduled.lastExecuted
            ? new Date(scheduled.lastExecuted).toISOString().substring(0, 7)
            : null;

        if (lastExecutedMonth === currentMonth) {
            continue;
        }

        const transaction = {
            type: scheduled.type,
            category: scheduled.category,
            description: scheduled.description,
            amount: scheduled.amount,
            date: today,
            month: currentMonth,
            createdAt: new Date(),
            updatedAt: new Date(),
            isScheduled: true,
            scheduledTransactionId: scheduled._id
        };

        const result = await transactionsCollection.insertOne(transaction);

        if (result.insertedId) {
            await scheduledCollection.updateOne(
                { _id: scheduled._id },
                { $set: { lastExecuted: today } }
            );
            processedCount++;
        }
    }

    return {
        success: true,
        processedCount,
        message: `Elaborate ${processedCount} transazioni programmate`
    };
}

app.whenReady().then(async () => {
    await connectToDatabase();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (mongoClient) {
        await mongoClient.close();
    }
});