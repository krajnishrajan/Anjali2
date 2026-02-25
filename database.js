// IndexedDB Database Manager for Expense Tracker
class ExpenseTrackerDB {
    constructor() {
        this.dbName = 'ExpenseTrackerDB';
        this.dbVersion = 1;
        this.db = null;
    }

    // Initialize the database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Users object store
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'username' });
                    userStore.createIndex('userId', 'userId', { unique: true });
                    userStore.createIndex('loginTime', 'loginTime', { unique: false });
                }

                // Transactions object store
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: false });
                    transactionStore.createIndex('userId', 'userId', { unique: false });
                    transactionStore.createIndex('type', 'type', { unique: false });
                    transactionStore.createIndex('date', 'date', { unique: false });
                    transactionStore.createIndex('userId_date', ['userId', 'date'], { unique: false });
                }

                // Recurring transactions object store
                if (!db.objectStoreNames.contains('recurringTransactions')) {
                    const recurringStore = db.createObjectStore('recurringTransactions', { keyPath: 'id', autoIncrement: false });
                    recurringStore.createIndex('userId', 'userId', { unique: false });
                    recurringStore.createIndex('type', 'type', { unique: false });
                }

                // Splits object store
                if (!db.objectStoreNames.contains('splits')) {
                    const splitStore = db.createObjectStore('splits', { keyPath: 'id', autoIncrement: false });
                    splitStore.createIndex('userId', 'userId', { unique: false });
                    splitStore.createIndex('date', 'date', { unique: false });
                }

                // User settings object store
                if (!db.objectStoreNames.contains('userSettings')) {
                    const settingsStore = db.createObjectStore('userSettings', { keyPath: 'userId', autoIncrement: false });
                }
            };
        });
    }

    // Simple hash function for passwords (in production, use proper hashing like bcrypt)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // User Management
    async registerUser(username, password) {
        if (!this.db) await this.init();

        const hashedPassword = await this.hashPassword(password);
        const userId = this.generateUserId();

        const user = {
            username: username,
            passwordHash: hashedPassword,
            userId: userId,
            createdAt: new Date().toISOString(),
            loginTime: new Date().toISOString(),
            avatar: null
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.add(user);

            request.onsuccess = () => {
                const { passwordHash, ...userWithoutPassword } = user;
                resolve(userWithoutPassword);
            };
            request.onerror = () => {
                if (request.error.name === 'ConstraintError') {
                    reject(new Error('Username already exists'));
                } else {
                    reject(request.error);
                }
            };
        });
    }

    async loginUser(username, password) {
        if (!this.db) await this.init();

        const hashedPassword = await this.hashPassword(password);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(username);

            request.onsuccess = () => {
                const user = request.result;
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                if (user.passwordHash === hashedPassword) {
                    // Update login time
                    user.loginTime = new Date().toISOString();
                    const updateTransaction = this.db.transaction(['users'], 'readwrite');
                    const updateStore = updateTransaction.objectStore('users');
                    updateStore.put(user);

                    // Return user without password hash
                    const { passwordHash, ...userWithoutPassword } = user;
                    resolve(userWithoutPassword);
                } else {
                    reject(new Error('Invalid password'));
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getUserByUsername(username) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(username);

            request.onsuccess = () => {
                const user = request.result;
                if (user) {
                    const { passwordHash, ...userWithoutPassword } = user;
                    resolve(userWithoutPassword);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async updateUser(username, updates) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const getRequest = store.get(username);

            getRequest.onsuccess = () => {
                const user = getRequest.result;
                if (!user) {
                    reject(new Error('User not found'));
                    return;
                }

                Object.assign(user, updates);
                const putRequest = store.put(user);

                putRequest.onsuccess = () => {
                    const { passwordHash, ...userWithoutPassword } = user;
                    resolve(userWithoutPassword);
                };
                putRequest.onerror = () => reject(putRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // Transaction Management
    async saveTransaction(userId, transaction) {
        if (!this.db) await this.init();

        const transactionWithUserId = {
            ...transaction,
            userId: userId,
            createdAt: transaction.createdAt || new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const dbTransaction = this.db.transaction(['transactions'], 'readwrite');
            const store = dbTransaction.objectStore('transactions');
            const request = store.put(transactionWithUserId);

            request.onsuccess = () => resolve(transactionWithUserId);
            request.onerror = () => reject(request.error);
        });
    }

    async getTransactions(userId, filter = {}) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('userId');
            const request = index.getAll(userId);

            request.onsuccess = () => {
                let transactions = request.result;

                // Apply filters
                if (filter.type) {
                    transactions = transactions.filter(t => t.type === filter.type);
                }

                if (filter.startDate) {
                    transactions = transactions.filter(t => t.date >= filter.startDate);
                }

                if (filter.endDate) {
                    transactions = transactions.filter(t => t.date <= filter.endDate);
                }

                // Sort by date (newest first)
                transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Limit results if specified
                if (filter.limit) {
                    transactions = transactions.slice(0, filter.limit);
                }

                resolve(transactions);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getRecentTransactions(userId, limit = 50) {
        return this.getTransactions(userId, { limit });
    }

    async deleteTransaction(userId, transactionId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readwrite');
            const store = transaction.objectStore('transactions');
            const request = store.get(transactionId);

            request.onsuccess = () => {
                const trans = request.result;
                if (!trans || trans.userId !== userId) {
                    reject(new Error('Transaction not found or access denied'));
                    return;
                }

                const deleteRequest = store.delete(transactionId);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // Recurring Transactions
    async saveRecurringTransaction(userId, recurringTransaction) {
        if (!this.db) await this.init();

        const recurringWithUserId = {
            ...recurringTransaction,
            userId: userId
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recurringTransactions'], 'readwrite');
            const store = transaction.objectStore('recurringTransactions');
            const request = store.put(recurringWithUserId);

            request.onsuccess = () => resolve(recurringWithUserId);
            request.onerror = () => reject(request.error);
        });
    }

    async getRecurringTransactions(userId, type = null) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['recurringTransactions'], 'readonly');
            const store = transaction.objectStore('recurringTransactions');
            const index = store.index('userId');
            const request = index.getAll(userId);

            request.onsuccess = () => {
                let recurring = request.result;
                if (type) {
                    recurring = recurring.filter(r => r.type === type);
                }
                resolve(recurring);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // Splits Management
    async saveSplit(userId, split) {
        if (!this.db) await this.init();

        const splitWithUserId = {
            ...split,
            userId: userId
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['splits'], 'readwrite');
            const store = transaction.objectStore('splits');
            const request = store.put(splitWithUserId);

            request.onsuccess = () => resolve(splitWithUserId);
            request.onerror = () => reject(request.error);
        });
    }

    async getSplits(userId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['splits'], 'readonly');
            const store = transaction.objectStore('splits');
            const index = store.index('userId');
            const request = index.getAll(userId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteSplit(userId, splitId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['splits'], 'readwrite');
            const store = transaction.objectStore('splits');
            const getRequest = store.get(splitId);

            getRequest.onsuccess = () => {
                const split = getRequest.result;
                if (!split || split.userId !== userId) {
                    reject(new Error('Split not found or access denied'));
                    return;
                }

                const deleteRequest = store.delete(splitId);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => reject(deleteRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async saveSplits(userId, splits) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['splits'], 'readwrite');
            const store = transaction.objectStore('splits');
            
            transaction.onerror = (e) => reject(e?.target?.error || new Error('Transaction failed'));
            transaction.oncomplete = () => resolve();

            // Clear existing splits for this user
            const index = store.index('userId');
            const getAllRequest = index.getAll(userId);
            
            getAllRequest.onsuccess = () => {
                const existingSplits = getAllRequest.result;
                existingSplits.forEach(split => {
                    store.delete(split.id);
                });

                // Add new splits
                // Ensure each split has an id (older migrated data may lack it)
                splits.forEach(split => {
                    const safeSplit = { ...split };
                    if (!safeSplit.id) {
                        safeSplit.id = `split-${Date.now()}-${Math.random().toString(36).substring(2,9)}`;
                    }
                    const splitWithUserId = { ...safeSplit, userId: userId };
                    try {
                        store.put(splitWithUserId);
                    } catch (err) {
                        // If an individual put fails, log but allow transaction to surface the error
                        console.error('Error putting split into store', err, splitWithUserId);
                        throw err;
                    }
                });
            };

            getAllRequest.onerror = () => reject(getAllRequest.error);
        });
    }

    // User Settings
    async saveUserSettings(userId, settings) {
        if (!this.db) await this.init();

        const settingsWithUserId = {
            userId: userId,
            ...settings,
            updatedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userSettings'], 'readwrite');
            const store = transaction.objectStore('userSettings');
            const request = store.put(settingsWithUserId);

            request.onsuccess = () => resolve(settingsWithUserId);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserSettings(userId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userSettings'], 'readonly');
            const store = transaction.objectStore('userSettings');
            const request = store.get(userId);

            request.onsuccess = () => resolve(request.result || {});
            request.onerror = () => reject(request.error);
        });
    }

    // Check if user ID exists
    async userIdExists(userId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const index = store.index('userId');
            const request = index.get(userId);

            request.onsuccess = () => {
                resolve(request.result !== undefined);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Migration from localStorage
    async migrateFromLocalStorage() {
        if (!this.db) await this.init();

        try {
            // Check if migration already done
            const settings = await this.getUserSettings('migration');
            if (settings.migrated) {
                return { migrated: true, message: 'Already migrated' };
            }

            // Migrate user data
            const savedUser = localStorage.getItem('expenseTrackerUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                // Note: We can't migrate password, user will need to re-register
                // But we can preserve their transactions
            }

            // Mark as migrated
            await this.saveUserSettings('migration', { migrated: true });

            return { migrated: true, message: 'Migration completed' };
        } catch (error) {
            console.error('Migration error:', error);
            return { migrated: false, error: error.message };
        }
    }

    // Utility function
    generateUserId() {
        const randomSegment = Math.random().toString(36).substring(2, 8).toUpperCase();
        const timeSegment = Date.now().toString(36).slice(-4).toUpperCase();
        return `USR-${randomSegment}${timeSegment}`;
    }
}

