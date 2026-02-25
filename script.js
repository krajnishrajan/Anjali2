// Expense Tracker App
class ExpenseTracker {
    constructor() {
        this.currentUser = null;
        this.transactions = [];
        this.recurringIncomes = [];
        this.recurringExpenses = [];
        this.splits = [];
        this.oweLimit = null;
        this.isDarkMode = false;
        this.currentSplitMode = 'even';
        this.currency = 'INR';
        this.db = new ExpenseTrackerDB();
        
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            await this.migrateFromLocalStorage();
            await this.loadUserData();
            this.setupEventListeners();
            this.setupTheme();
            this.setupDateInputs();
            await this.checkRecurringTransactions();
            this.updateProfileUI();
            this.renderSplitSummary();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Failed to initialize database', 'error');
        }
    }

    // Authentication
    async loadUserData() {
        try {
            // Try to get user from localStorage first (for migration)
            const savedUser = localStorage.getItem('expenseTrackerUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                // Check if user exists in database
                const dbUser = await this.db.getUserByUsername(user.username);
                if (dbUser) {
                    this.currentUser = dbUser;
                } else {
                    // User exists in localStorage but not in DB - show login
                    this.showLoginScreen();
                    return;
                }
            } else {
                this.showLoginScreen();
                return;
            }

            this.ensureUserProfileDefaults();
            await this.loadTransactions();
            this.showMainApp();
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showLoginScreen();
        }
    }

    async saveUserData() {
        if (this.currentUser && this.currentUser.username) {
            try {
                await this.db.updateUser(this.currentUser.username, {
                    loginTime: this.currentUser.loginTime,
                    avatar: this.currentUser.avatar,
                    userId: this.currentUser.userId
                });
                // Also keep in localStorage for backward compatibility
                localStorage.setItem('expenseTrackerUser', JSON.stringify(this.currentUser));
            } catch (error) {
                console.error('Error saving user data:', error);
            }
        }
    }

    async migrateFromLocalStorage() {
        try {
            const savedUser = localStorage.getItem('expenseTrackerUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                // Check if user exists in database
                const dbUser = await this.db.getUserByUsername(user.username);
                if (!dbUser) {
                    // if user data not exist in db then it require to register then data can migrate to local storage
                }
            }

            // Migrate transactions
            const savedTransactions = localStorage.getItem('expenseTrackerTransactions');
            if (savedTransactions && this.currentUser) {
                const transactions = JSON.parse(savedTransactions);
                for (const transaction of transactions) {
                    if (!transaction.userId) {
                        transaction.userId = this.currentUser.userId;
                        await this.db.saveTransaction(this.currentUser.userId, transaction);
                    }
                }
            }
        } catch (error) {
            console.error('Migration error:', error);
        }
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        this.updateDashboard();
        this.renderTransactions();
        this.updateProfileUI();
        this.renderSplitSummary();
    }

    // Event Listeners
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register link
        document.getElementById('registerLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Action buttons
        document.getElementById('addExpenseBtn').addEventListener('click', () => {
            this.openModal('expenseModal');
        });

        document.getElementById('addIncomeBtn').addEventListener('click', () => {
            this.openModal('incomeModal');
        });

        document.getElementById('viewReportsBtn').addEventListener('click', () => {
            this.openModal('shareModal');
        });

        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => {
            this.openModal('shareModal');
        });

        // Modal forms
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddExpense();
        });

        document.getElementById('incomeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddIncome();
        });

        // Close modals (use currentTarget and guard)
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.currentTarget.closest('.modal');
                if (modal) this.closeModal(modal);
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        // Filter buttons (use currentTarget to avoid clicks on inner elements causing undefined)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.handleFilter(filter);
            });
        });

        // Share options
        document.getElementById('shareText').addEventListener('click', () => {
            this.shareAsText();
        });

        document.getElementById('shareImage').addEventListener('click', () => {
            this.shareAsImage();
        });

        document.getElementById('shareEmail').addEventListener('click', () => {
            this.shareAsEmail();
        });

        // Split actions
        document.getElementById('addSplitBtn').addEventListener('click', () => {
            this.prepareSplitForm();
            this.updateSplitLimitUI();
            this.openModal('splitModal');
        });

        // Currency change listener
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.addEventListener('change', async (e) => {
                this.currency = e.target.value;
                await this.saveSplitData();
                this.renderTransactions();
                this.updateDashboard();
                this.showNotification(`Currency changed to ${this.currency}`, 'success');
            });
        }

        document.getElementById('splitForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddSplit();
        });

        document.getElementById('addCounterpartyBtn').addEventListener('click', () => {
            this.addCounterpartyRow();
        });

        const counterpartiesContainer = document.getElementById('counterpartiesContainer');
        if (counterpartiesContainer) {
            counterpartiesContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-counterparty-btn');
                if (removeBtn) {
                    const row = removeBtn.closest('.counterparty-row');
                    this.removeCounterpartyRow(row);
                }
            });
        }

        // Delegated delete handlers for transactions and splits
        const transactionsList = document.getElementById('transactionsList');
        if (transactionsList) {
            transactionsList.addEventListener('click', (e) => {
                const btn = e.target.closest('.delete-transaction-btn');
                if (btn) {
                    const id = btn.dataset.id;
                    this.handleDeleteTransaction(id);
                }
            });
        }

        const owedList = document.getElementById('owedList');
        if (owedList) {
            owedList.addEventListener('click', (e) => {
                const btn = e.target.closest('.delete-split-btn');
                if (btn) {
                    const id = btn.dataset.id;
                    this.handleDeleteSplit(id);
                }
            });
        }

        const oweList = document.getElementById('oweList');
        if (oweList) {
            oweList.addEventListener('click', (e) => {
                const btn = e.target.closest('.delete-split-btn');
                if (btn) {
                    const id = btn.dataset.id;
                    this.handleDeleteSplit(id);
                }
            });
        }

        document.querySelectorAll('input[name="splitMode"]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.setSplitMode(e.target.value);
            });
        });

        // Toggle expense category section when "Add as expense" checkbox is changed
        const splitAddAsExpenseCheckbox = document.getElementById('splitAddAsExpense');
        if (splitAddAsExpenseCheckbox) {
            splitAddAsExpenseCheckbox.addEventListener('change', (e) => {
                const categorySection = document.getElementById('splitExpenseCategorySection');
                if (categorySection) {
                    if (e.target.checked) {
                        categorySection.classList.remove('hidden');
                    } else {
                        categorySection.classList.add('hidden');
                    }
                }
            });
        }

        document.getElementById('splitLimitSaveBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSaveOweLimit();
        });

        // Profile interactions
        document.getElementById('profileBtn').addEventListener('click', () => {
            this.updateProfileUI();
            this.openModal('profileModal');
        });

        document.getElementById('profileImageInput').addEventListener('change', (e) => {
            this.handleProfileImageUpload(e);
        });

        document.getElementById('logoutBtnProfile').addEventListener('click', () => {
            this.closeModal(document.getElementById('profileModal'));
            this.handleLogout();
        });

        this.prepareSplitForm();
    }

    // Authentication handlers
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            const user = await this.db.loginUser(username, password);
            this.currentUser = user;
            await this.saveUserData();
            await this.loadTransactions();
            this.showMainApp();
            this.showNotification('Welcome back!', 'success');
        } catch (error) {
            this.showNotification(error.message || 'Login failed', 'error');
        }
    }

    async handleRegister() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            const user = await this.db.registerUser(username, password);
            this.currentUser = user;
            await this.saveUserData();
            
            // Initialize empty data
            this.transactions = [];
            this.recurringIncomes = [];
            this.recurringExpenses = [];
            this.splits = [];
            this.oweLimit = null;
            await this.saveTransactions();
            await this.saveSplitData();
            this.showMainApp();
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            this.showNotification(error.message || 'Registration failed', 'error');
        }
    }

    async handleLogout() {
        this.currentUser = null;
        this.transactions = [];
        this.recurringIncomes = [];
        this.recurringExpenses = [];
        this.splits = [];
        this.oweLimit = null;
        localStorage.removeItem('expenseTrackerUser');
        // Keep localStorage cleanup for backward compatibility
        localStorage.removeItem('expenseTrackerTransactions');
        localStorage.removeItem('expenseTrackerRecurringIncomes');
        localStorage.removeItem('expenseTrackerRecurringExpenses');
        localStorage.removeItem('expenseTrackerSplits');
        localStorage.removeItem('expenseTrackerOweLimit');
        this.showLoginScreen();
        this.updateProfileUI();
        this.renderSplitSummary();
        this.showNotification('Logged out successfully', 'success');
    }

    // Theme management
    setupTheme() {
        const savedTheme = localStorage.getItem('expenseTrackerTheme');
        if (savedTheme === 'dark') {
            this.isDarkMode = true;
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('expenseTrackerTheme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('expenseTrackerTheme', 'light');
        }
    }

    // Date setup
    setupDateInputs() {
        const today = new Date().toISOString().split('T')[0];
        const expenseDate = document.getElementById('expenseDate');
        const incomeDate = document.getElementById('incomeDate');
        const splitDate = document.getElementById('splitDate');

        if (expenseDate) expenseDate.value = today;
        if (incomeDate) incomeDate.value = today;
        if (splitDate) splitDate.value = today;
    }

    // Transaction management
    async loadTransactions() {
        if (!this.currentUser || !this.currentUser.userId) {
            return;
        }

        try {
            // Load transactions from database
            this.transactions = await this.db.getTransactions(this.currentUser.userId);
            
            // Load recurring transactions
            this.recurringIncomes = await this.db.getRecurringTransactions(this.currentUser.userId, 'income');
            this.recurringExpenses = await this.db.getRecurringTransactions(this.currentUser.userId, 'expense');

            await this.loadSplitData();
        } catch (error) {
            console.error('Error loading transactions:', error);
            // Fallback to localStorage if database fails
            const saved = localStorage.getItem('expenseTrackerTransactions');
            if (saved) {
                this.transactions = JSON.parse(saved);
            }
        }
    }

    async saveTransactions() {
        if (!this.currentUser || !this.currentUser.userId) {
            return;
        }

        try {
            // Save all transactions to database
            for (const transaction of this.transactions) {
                await this.db.saveTransaction(this.currentUser.userId, transaction);
            }

            // Save recurring transactions
            for (const recurring of this.recurringIncomes) {
                await this.db.saveRecurringTransaction(this.currentUser.userId, recurring);
            }

            for (const recurring of this.recurringExpenses) {
                await this.db.saveRecurringTransaction(this.currentUser.userId, recurring);
            }

            // Also save to localStorage for backward compatibility
            localStorage.setItem('expenseTrackerTransactions', JSON.stringify(this.transactions));
            localStorage.setItem('expenseTrackerRecurringIncomes', JSON.stringify(this.recurringIncomes));
            localStorage.setItem('expenseTrackerRecurringExpenses', JSON.stringify(this.recurringExpenses));
        } catch (error) {
            console.error('Error saving transactions:', error);
        }
    }

    async loadSplitData() {
        if (!this.currentUser || !this.currentUser.userId) {
            return;
        }

        try {
            // Load splits from database
            this.splits = await this.db.getSplits(this.currentUser.userId);

            // Load user settings (including oweLimit and currency)
            const settings = await this.db.getUserSettings(this.currentUser.userId);
            if (settings.oweLimit !== undefined) {
                this.oweLimit = settings.oweLimit;
            }
            if (settings.currency !== undefined) {
                this.currency = settings.currency;
            }

            // Fallback to localStorage if database doesn't have data
            if (this.splits.length === 0) {
                const savedSplits = localStorage.getItem('expenseTrackerSplits');
                if (savedSplits) {
                    try {
                        this.splits = JSON.parse(savedSplits);
                    } catch {
                        this.splits = [];
                    }
                }
            }

            if (this.oweLimit === null) {
                const savedLimit = localStorage.getItem('expenseTrackerOweLimit');
                if (savedLimit !== null) {
                    const parsed = parseFloat(savedLimit);
                    this.oweLimit = isNaN(parsed) ? null : parsed;
                }
            }
        } catch (error) {
            console.error('Error loading split data:', error);
            // Fallback to localStorage
            const savedSplits = localStorage.getItem('expenseTrackerSplits');
            if (savedSplits) {
                try {
                    this.splits = JSON.parse(savedSplits);
                } catch {
                    this.splits = [];
                }
            }
        }
    }

    async saveSplitData() {
        if (!this.currentUser || !this.currentUser.userId) {
            return;
        }

        try {
            // Save splits to database
            await this.db.saveSplits(this.currentUser.userId, this.splits);

            // Save user settings (including oweLimit and currency)
            await this.db.saveUserSettings(this.currentUser.userId, {
                oweLimit: this.oweLimit,
                currency: this.currency
            });

            // Also save to localStorage for backward compatibility
            localStorage.setItem('expenseTrackerSplits', JSON.stringify(this.splits));
            if (this.oweLimit !== null && !isNaN(this.oweLimit)) {
                localStorage.setItem('expenseTrackerOweLimit', this.oweLimit);
            } else {
                localStorage.removeItem('expenseTrackerOweLimit');
            }
        } catch (error) {
            console.error('Error saving split data:', error);
            throw error; // Re-throw to allow caller to handle
        }
    }

    // Check for recurring incomes and expenses
    async checkRecurringTransactions() {
        if (!this.currentUser || !this.currentUser.userId) {
            return;
        }

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        let hasChanges = false;

        const processRecurringList = async (list, transactionType) => {
            for (const item of list) {
                const lastAdded = item.lastAdded ? new Date(item.lastAdded) : null;
                const shouldAdd = !lastAdded || lastAdded.getMonth() !== currentMonth || lastAdded.getFullYear() !== currentYear;

                if (shouldAdd) {
                    const newTransaction = {
                        id: Date.now() + Math.random(),
                        type: transactionType,
                        title: item.title,
                        amount: item.amount,
                        category: transactionType === 'income' ? (item.incomeType || item.type || item.category) : item.category,
                        date: now.toISOString().split('T')[0],
                        description: item.description ? `Recurring: ${item.description}` : 'Recurring entry',
                        isRecurring: true
                    };

                    this.transactions.push(newTransaction);
                    await this.db.saveTransaction(this.currentUser.userId, newTransaction);
                    
                    item.lastAdded = now.toISOString();
                    await this.db.saveRecurringTransaction(this.currentUser.userId, item);
                    hasChanges = true;
                }
            }
        };

        await processRecurringList(this.recurringIncomes, 'income');
        await processRecurringList(this.recurringExpenses, 'expense');

        if (hasChanges) {
            await this.saveTransactions();
            this.updateDashboard();
            this.renderTransactions();
        }
    }

    // Modal management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('show');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('show');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset forms
        if (modal.id === 'expenseModal') {
            document.getElementById('expenseForm').reset();
            this.setupDateInputs();
        } else if (modal.id === 'incomeModal') {
            document.getElementById('incomeForm').reset();
            this.setupDateInputs();
        } else if (modal.id === 'profileModal') {
            const input = document.getElementById('profileImageInput');
            if (input) {
                input.value = '';
            }
            // Set currency selector to current value
            const currencySelect = document.getElementById('currencySelect');
            if (currencySelect) {
                currencySelect.value = this.currency;
            }
        } else if (modal.id === 'splitModal') {
            this.prepareSplitForm();
        }
    }

    // Form handlers
    async handleAddExpense() {
        if (!this.currentUser || !this.currentUser.userId) {
            this.showNotification('Please login first', 'error');
            return;
        }

        const title = document.getElementById('expenseTitle').value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const date = document.getElementById('expenseDate').value;
        const description = document.getElementById('expenseDescription').value;
        const isRecurring = document.getElementById('expenseIsRecurring').checked;

        if (!title || !amount || !category || !date) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const transaction = {
            id: Date.now() + Math.random(),
            type: 'expense',
            title,
            amount,
            category,
            date,
            description,
            isRecurring
        };

        try {
            // Save to database
            await this.db.saveTransaction(this.currentUser.userId, transaction);
            this.transactions.push(transaction);

            if (isRecurring) {
                const recurringExpense = {
                    id: Date.now() + Math.random(),
                    title,
                    amount,
                    category,
                    description,
                    lastAdded: new Date().toISOString(),
                    type: 'expense'
                };
                this.recurringExpenses.push(recurringExpense);
                await this.db.saveRecurringTransaction(this.currentUser.userId, recurringExpense);
            }

            await this.saveTransactions();
            this.updateDashboard();
            this.renderTransactions();
            this.closeModal(document.getElementById('expenseModal'));
            this.showNotification('Expense added successfully!', 'success');
        } catch (error) {
            console.error('Error adding expense:', error);
            this.showNotification('Failed to save expense', 'error');
        }
    }

    async handleAddIncome() {
        if (!this.currentUser || !this.currentUser.userId) {
            this.showNotification('Please login first', 'error');
            return;
        }

        const title = document.getElementById('incomeTitle').value;
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        const type = document.getElementById('incomeType').value;
        const date = document.getElementById('incomeDate').value;
        const description = document.getElementById('incomeDescription').value;
        const isRecurring = document.getElementById('isRecurring').checked;

        if (!title || !amount || !type || !date) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const transaction = {
            id: Date.now() + Math.random(),
            type: 'income',
            title,
            amount,
            category: type,
            date,
            description,
            isRecurring
        };

        try {
            // Save to database
            await this.db.saveTransaction(this.currentUser.userId, transaction);
            this.transactions.push(transaction);

            // If recurring, add to recurring incomes
            if (isRecurring) {
                const recurringIncome = {
                    id: Date.now() + Math.random(),
                    title,
                    amount,
                    incomeType: type, // Store the income type (salary, freelance, etc.)
                    description,
                    lastAdded: new Date().toISOString(),
                    type: 'income' // This indicates it's an income recurring transaction
                };
                this.recurringIncomes.push(recurringIncome);
                await this.db.saveRecurringTransaction(this.currentUser.userId, recurringIncome);
            }

            await this.saveTransactions();
            this.updateDashboard();
            this.renderTransactions();
            this.closeModal(document.getElementById('incomeModal'));
            this.showNotification('Income added successfully!', 'success');
        } catch (error) {
            console.error('Error adding income:', error);
            this.showNotification('Failed to save income', 'error');
        }
    }

    // Dashboard updates
    updateDashboard() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpenses = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const balance = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0;

        document.getElementById('totalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('totalExpenses').textContent = this.formatCurrency(totalExpenses);
        document.getElementById('balance').textContent = this.formatCurrency(balance);
        document.getElementById('savingsRate').textContent = `${savingsRate}%`;

        // Update balance color
        const balanceElement = document.getElementById('balance');
        if (balance >= 0) {
            balanceElement.style.color = 'var(--success-color)';
        } else {
            balanceElement.style.color = 'var(--error-color)';
        }
    }

    // Transaction rendering
    renderTransactions(filter = 'all') {
        const container = document.getElementById('transactionsList');
        let filteredTransactions = this.transactions;

        if (filter === 'income') {
            filteredTransactions = this.transactions.filter(t => t.type === 'income');
        } else if (filter === 'expense') {
            filteredTransactions = this.transactions.filter(t => t.type === 'expense');
        }

        // Sort by date (newest first)
        filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredTransactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No transactions found</h3>
                    <p>Add your first ${filter === 'all' ? 'transaction' : filter} to get started!</p>
                </div>
            `;
            return;
        }
        container.innerHTML = filteredTransactions.map(transaction => `
            <div class="transaction-item ${transaction.type}" data-id="${transaction.id}">
                <div class="transaction-info">
                    <div class="transaction-icon">
                        <i class="fas ${this.getCategoryIcon(transaction.category)}"></i>
                    </div>
                    <div class="transaction-details">
                        <h4>${transaction.title}</h4>
                        <p>${this.formatDate(transaction.date)} • ${this.getCategoryName(transaction.category)}</p>
                        ${transaction.description ? `<p class="description">${transaction.description}</p>` : ''}
                        ${transaction.isRecurring ? '<span class="recurring-badge">Recurring</span>' : ''}
                    </div>
                </div>
                <div class="transaction-amount">
                    ${transaction.type === 'income' ? '+' : '-'}${this.formatCurrency(transaction.amount)}
                </div>
                <button class="delete-transaction-btn" data-id="${transaction.id}" aria-label="Delete transaction">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        // Delegated listener for delete buttons (also handles clicks added after render)
        container.querySelectorAll('.delete-transaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.handleDeleteTransaction(id);
            });
        });
    }

    // Filter handling
    handleFilter(filter) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        this.renderTransactions(filter);
    }

    // Utility functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.currency
        }).format(amount);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getCategoryIcon(category) {
        const icons = {
            rent: 'fa-home',
            emi: 'fa-credit-card',
            food: 'fa-utensils',
            transport: 'fa-car',
            shopping: 'fa-shopping-bag',
            entertainment: 'fa-film',
            bills: 'fa-file-invoice',
            healthcare: 'fa-heartbeat',
            education: 'fa-graduation-cap',
            salary: 'fa-briefcase',
            freelance: 'fa-laptop',
            investment: 'fa-chart-line',
            business: 'fa-building',
            other: 'fa-ellipsis-h'
        };
        return icons[category] || 'fa-ellipsis-h';
    }

    getCategoryName(category) {
        const names = {
            rent: 'House Rent',
            emi: 'EMI / Loan',
            food: 'Food & Dining',
            transport: 'Transportation',
            shopping: 'Shopping',
            entertainment: 'Entertainment',
            bills: 'Bills & Utilities',
            healthcare: 'Healthcare',
            education: 'Education',
            salary: 'Salary',
            freelance: 'Freelance',
            investment: 'Investment',
            business: 'Business',
            other: 'Other'
        };
        return names[category] || 'Other';
    }

    // Profile management
    ensureUserProfileDefaults() {
        if (!this.currentUser) return;
        let shouldSave = false;

        if (!this.currentUser.userId) {
            this.currentUser.userId = this.generateUserId();
            shouldSave = true;
        }

        if (!Object.prototype.hasOwnProperty.call(this.currentUser, 'avatar')) {
            this.currentUser.avatar = null;
            shouldSave = true;
        }

        if (shouldSave) {
            this.saveUserData();
        }
    }

    generateUserId() {
        const randomSegment = Math.random().toString(36).substring(2, 8).toUpperCase();
        const timeSegment = Date.now().toString(36).slice(-4).toUpperCase();
        return `USR-${randomSegment}${timeSegment}`;
    }

    generateAvatarPlaceholder(name = 'User') {
        const safeName = (name || 'User').trim();
        const initial = (safeName.charAt(0) || 'U').toUpperCase();
        const hue = (initial.charCodeAt(0) * 19) % 360;
        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
                <defs>
                    <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>
                        <stop offset='0%' stop-color='hsl(${hue},70%,55%)'/>
                        <stop offset='100%' stop-color='hsl(${(hue + 60) % 360},70%,50%)'/>
                    </linearGradient>
                </defs>
                <rect width='100' height='100' rx='50' fill='url(#grad)'/>
                <text x='50' y='62' font-size='50' font-family='Inter, sans-serif' fill='white' text-anchor='middle'>${initial}</text>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    }

    getProfileImageSource() {
        if (this.currentUser && this.currentUser.avatar) {
            return this.currentUser.avatar;
        }
        const name = this.currentUser?.username || 'User';
        return this.generateAvatarPlaceholder(name);
    }

    updateProfileUI() {
        const username = this.currentUser?.username || 'Guest';
        const userId = this.currentUser?.userId || 'Not assigned';
        const avatarSrc = this.getProfileImageSource();

        const avatarButtonImage = document.getElementById('profileAvatar');
        if (avatarButtonImage) {
            avatarButtonImage.src = avatarSrc;
        }

        const previewImage = document.getElementById('profilePreview');
        if (previewImage) {
            previewImage.src = avatarSrc;
        }

        const usernameElement = document.getElementById('profileUsername');
        if (usernameElement) {
            usernameElement.textContent = username;
        }

        const userIdElement = document.getElementById('profileUserId');
        if (userIdElement) {
            userIdElement.textContent = userId;
        }

        const userIdText = document.getElementById('profileIdText');
        if (userIdText) {
            userIdText.textContent = `ID: ${userId}`;
        }
    }

    async handleProfileImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showNotification('Please choose an image smaller than 5MB', 'error');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            if (!this.currentUser) {
                event.target.value = '';
                return;
            }

            this.currentUser.avatar = reader.result;
            await this.saveUserData();
            this.updateProfileUI();
            this.showNotification('Profile photo updated!', 'success');
            event.target.value = '';
        };
        reader.readAsDataURL(file);
    }

    prepareSplitForm() {
        const splitForm = document.getElementById('splitForm');
        if (splitForm) {
            splitForm.reset();
            
            // Reset expense checkbox and hide category section
            const addAsExpenseCheckbox = document.getElementById('splitAddAsExpense');
            const categorySection = document.getElementById('splitExpenseCategorySection');
            if (addAsExpenseCheckbox) {
                addAsExpenseCheckbox.checked = false;
            }
            if (categorySection) {
                categorySection.classList.add('hidden');
            }
            this.setupDateInputs();
        }
        this.resetCounterparties();
        this.addCounterpartyRow();
        const evenOption = document.querySelector('input[name="splitMode"][value="even"]');
        if (evenOption) {
            evenOption.checked = true;
        }
        const directionDefault = document.querySelector('input[name="splitDirection"][value="counterpartiesOweYou"]');
        if (directionDefault) directionDefault.checked = true;
        this.setSplitMode('even');
        const myShare = document.getElementById('myShareAmount');
        if (myShare) {
            myShare.value = '0';
        }
    }

    resetCounterparties() {
        const container = document.getElementById('counterpartiesContainer');
        if (container) {
            container.innerHTML = '';
        }
    }

    addCounterpartyRow(data = {}) {
        const container = document.getElementById('counterpartiesContainer');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'counterparty-row';
        row.innerHTML = `
            <input type="text" class="counterparty-name" placeholder="Name" value="${data.name || ''}" required>
            <input type="text" class="counterparty-id" placeholder="User ID" value="${data.id || ''}" required>
            <input type="number" class="counterparty-amount" placeholder="Amount" min="0" step="0.01" value="${data.amount != null ? data.amount : ''}">
            <button type="button" class="remove-counterparty-btn" aria-label="Remove person">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(row);
        this.applySplitModeToRow(row);
    }

    removeCounterpartyRow(row) {
        const container = document.getElementById('counterpartiesContainer');
        if (!container || !row) return;

        if (container.children.length <= 1) {
            this.showNotification('At least one counterparty is required', 'error');
            return;
        }

        row.remove();
    }

    getCounterpartyRows() {
        const container = document.getElementById('counterpartiesContainer');
        if (!container) return [];
        return Array.from(container.querySelectorAll('.counterparty-row'));
    }

    calculateEvenSplit(totalAmount, count) {
        if (count <= 0) {
            return [];
        }

        const totalCents = Math.round(totalAmount * 100);
        const baseShare = Math.floor(totalCents / count);
        let remainder = totalCents - baseShare * count;

        return Array.from({ length: count }, () => {
            let shareCents = baseShare;
            if (remainder > 0) {
                shareCents += 1;
                remainder -= 1;
            }
            return shareCents / 100;
        });
    }

    setSplitMode(mode) {
        this.currentSplitMode = mode;
        const manualSection = document.getElementById('manualSplitSection');
        if (manualSection) {
            manualSection.classList.toggle('hidden', mode !== 'manual');
        }
        document.querySelectorAll('.counterparty-amount').forEach(input => {
            if (mode === 'manual') {
                input.disabled = false;
            } else {
                input.disabled = true;
                input.value = '';
            }
        });
        if (mode !== 'manual') {
            const myShare = document.getElementById('myShareAmount');
            if (myShare) {
                myShare.value = '0';
            }
        }
    }

    applySplitModeToRow(row) {
        const amountInput = row.querySelector('.counterparty-amount');
        if (!amountInput) return;
        if (this.currentSplitMode === 'manual') {
            amountInput.disabled = false;
        } else {
            amountInput.disabled = true;
            amountInput.value = '';
        }
    }

    // Check if a counterparty user ID exists
    async getCounterpartyUserIfExists(counterpartyId) {
        try {
            const exists = await this.db.userIdExists(counterpartyId);
            return exists ? counterpartyId : null;
        } catch (error) {
            console.error('Error checking counterparty:', error);
            return null;
        }
    }

    // Save mirrored split for counterparty
    async saveMirroredSplit(counterpartyUserId, split, creatorUserId, creatorName) {
        try {
            // Create mirrored split with opposite type
            const mirroredSplit = {
                ...split,
                id: `${split.groupId}-mirror-${Math.random().toString(36).substring(2, 11)}`,
                type: split.type === 'owed' ? 'owe' : 'owed',
                counterpartyName: creatorName,
                counterpartyId: creatorUserId,
                isMirrored: true
            };

            await this.db.saveSplit(counterpartyUserId, mirroredSplit);
        } catch (error) {
            console.error('Error saving mirrored split:', error);
        }
    }

    // Split functionality
    async handleAddSplit() {
        const title = document.getElementById('splitTitle').value.trim();
        const amountValue = parseFloat(document.getElementById('splitAmount').value);
        const date = document.getElementById('splitDate').value;
        const description = document.getElementById('splitDescription').value.trim();
        const counterpartyRows = this.getCounterpartyRows();
        const direction = (document.querySelector('input[name="splitDirection"]:checked') || {}).value || 'counterpartiesOweYou';

        if (!title || !amountValue || amountValue <= 0 || !date || counterpartyRows.length === 0) {
            this.showNotification('Please fill in all split fields correctly', 'error');
            return;
        }

        const counterparties = [];
        let hasInvalid = false;

        counterpartyRows.forEach(row => {
            const name = row.querySelector('.counterparty-name').value.trim();
            const id = row.querySelector('.counterparty-id').value.trim();
            const amountInput = row.querySelector('.counterparty-amount');
            let manualAmount = null;
            if (this.currentSplitMode === 'manual') {
                manualAmount = amountInput ? parseFloat(amountInput.value) : NaN;
                if (isNaN(manualAmount) || manualAmount < 0) {
                    hasInvalid = true;
                }
            }

            if (!name || !id) {
                hasInvalid = true;
            } else {
                counterparties.push({ name, id, amount: manualAmount });
            }
        });

        if (hasInvalid || counterparties.length === 0) {
            this.showNotification('Please complete all counterparty details', 'error');
            return;
        }

        // Validate that all user IDs exist
        for (const counterparty of counterparties) {
            const userExists = await this.getCounterpartyUserIfExists(counterparty.id);
            if (!userExists) {
                this.showNotification(`User doesn't exist: ${counterparty.id}`, 'error');
                return;
            }
        }

        let entries = [];
        if (this.currentSplitMode === 'manual') {
            const myShareInput = document.getElementById('myShareAmount');
            const myShare = myShareInput ? parseFloat(myShareInput.value) || 0 : 0;
            let counterpartyTotal = 0;
            const manualEntries = [];
            counterparties.forEach(participant => {
                const shareAmount = participant.amount != null ? participant.amount : 0;
                counterpartyTotal += shareAmount;
                manualEntries.push({
                    name: participant.name,
                    id: participant.id,
                    amount: shareAmount
                });
            });
            const manualSum = counterpartyTotal + myShare;
            if (Math.abs(manualSum - amountValue) > 0.01) {
                this.showNotification('Manual amounts (plus your share) must equal the total amount', 'error');
                return;
            }
            entries = manualEntries;
        } else {
            // Split evenly among all counterparties + the creator
            // (creator's share will be the remaining share and is not stored as an 'owed' entry)
            const shares = this.calculateEvenSplit(amountValue, counterparties.length + 1);
            entries = counterparties.map((participant, index) => ({
                name: participant.name,
                id: participant.id,
                amount: shares[index]
            }));
        }
        const groupId = Date.now();

        if (!this.currentUser || !this.currentUser.userId) {
            this.showNotification('Please login first', 'error');
            return;
        }

        try {
            // Collect mirrored split tasks
            const mirrorTasks = [];

            entries.forEach((participant, index) => {
                const split = {
                    id: `${groupId}-${index}-${Math.random().toString(36).substring(2, 11)}`,
                    groupId,
                    title,
                    amount: participant.amount,
                    // type: 'owed' means the participant owes you; 'owe' means you owe the participant
                    type: direction === 'youOweCounterparties' ? 'owe' : 'owed',
                    counterpartyName: participant.name,
                    counterpartyId: participant.id,
                    date,
                    description
                };
                this.splits.push(split);

                // Check if counterparty exists and queue mirrored split
                mirrorTasks.push(
                    this.getCounterpartyUserIfExists(participant.id).then(existingCounterpartyUserId => {
                        if (existingCounterpartyUserId) {
                            return this.saveMirroredSplit(existingCounterpartyUserId, split, this.currentUser.userId, this.currentUser.username);
                        }
                    })
                );
            });

            // Save to database
            await this.saveSplitData();
            // Save mirrored splits for existing counterparties
            await Promise.all(mirrorTasks);

            // Add as expense if checkbox is checked and user paid
            const addAsExpense = document.getElementById('splitAddAsExpense')?.checked;
            if (addAsExpense && direction === 'counterpartiesOweYou') {
                const category = document.getElementById('splitExpenseCategory')?.value || 'other';
                const expenseTransaction = {
                    id: `${groupId}-expense-${Math.random().toString(36).substring(2, 11)}`,
                    type: 'expense',
                    title: title,
                    amount: amountValue,
                    category: category,
                    date: date,
                    description: description ? `${description} (Split with ${entries.length} ${entries.length === 1 ? 'person' : 'people'})` : `Split with ${entries.length} ${entries.length === 1 ? 'person' : 'people'}`,
                    isRecurring: false,
                    splitId: groupId // Link to the split group
                };

                await this.db.saveTransaction(this.currentUser.userId, expenseTransaction);
                this.transactions.push(expenseTransaction);
                await this.saveTransactions();
                this.updateDashboard();
                this.renderTransactions();
            }

            this.renderSplitSummary();
            this.closeModal(document.getElementById('splitModal'));
            this.showNotification('Split saved successfully!', 'success');
            this.checkOweLimit();
        } catch (error) {
            console.error('Error saving split:', error);
            this.showNotification('Split saved successfully!', 'success');
        }
    }

    async handleSaveOweLimit() {
        if (!this.currentUser || !this.currentUser.userId) {
            this.showNotification('Please login first', 'error');
            return;
        }

        const input = document.getElementById('splitLimitInput');
        if (!input) return;

        const rawValue = input.value.trim();
        if (rawValue === '') {
            this.oweLimit = null;
            this.showNotification('Owe limit cleared', 'success');
        } else {
            const parsedValue = parseFloat(rawValue);
            if (isNaN(parsedValue) || parsedValue < 0) {
                this.showNotification('Please enter a valid positive limit', 'error');
                return;
            }
            this.oweLimit = parsedValue;
            this.showNotification('Owe limit updated', 'success');
        }

        try {
            await this.saveSplitData();
            this.renderSplitSummary();
            this.checkOweLimit();
        } catch (error) {
            console.error('Error saving owe limit:', error);
            this.showNotification('Owe limit updated', 'success');
        }
    }

    renderSplitSummary() {
        const totalOwedToYou = this.splits.filter(s => s.type === 'owed').reduce((sum, s) => sum + s.amount, 0);
        const totalOwedByYou = this.splits.filter(s => s.type === 'owe').reduce((sum, s) => sum + s.amount, 0);

        const owedElement = document.getElementById('totalOwedAmount');
        if (owedElement) owedElement.textContent = this.formatCurrency(totalOwedToYou);
        const oweElement = document.getElementById('totalOweAmount');
        if (oweElement) oweElement.textContent = this.formatCurrency(totalOwedByYou);

        // Render both lists
        this.renderSplitList('owedList', this.splits.filter(s => s.type === 'owed'), 'No pending repayments owed to you.');
        this.renderSplitList('oweList', this.splits.filter(s => s.type === 'owe'), 'You don\'t owe anyone.');

        const limitDisplay = document.getElementById('splitLimitDisplay');
        const isLimitSet = this.oweLimit !== null && !isNaN(this.oweLimit);
        const limitExceeded = this.isOweLimitExceeded();

        if (limitDisplay) {
            limitDisplay.textContent = `Limit: ${isLimitSet ? this.formatCurrency(this.oweLimit) : 'Not set'}`;
            limitDisplay.classList.toggle('over-limit', limitExceeded);
        }

        const owedCard = document.querySelector('.split-card.owed-card');
        if (owedCard) {
            owedCard.classList.toggle('over-limit', limitExceeded);
        }

        this.updateSplitLimitUI();
    }

    renderSplitList(containerId, splits, emptyMessage) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!splits.length) {
            container.innerHTML = `<div class="split-empty">${emptyMessage}</div>`;
            return;
        }

        const sorted = [...splits].sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = sorted.map(split => `
            <div class="split-item" data-id="${split.id}">
                <div>
                    <h4>${split.title}</h4>
                    <p>${split.counterpartyName} • ${split.counterpartyId || 'No ID'} • ${this.formatDate(split.date)}</p>
                    <small style="color:var(--text-muted)">${split.type === 'owed' ? 'Owed to you' : 'You owe'}</small>
                    ${split.description ? `<p>${split.description}</p>` : ''}
                </div>
                <div style="display:flex;gap:0.75rem;align-items:center">
                    <span class="split-amount ${split.type === 'owed' ? 'owed' : 'owe'}">${this.formatCurrency(split.amount)}</span>
                    <button class="delete-split-btn" data-id="${split.id}" aria-label="Delete split"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        // Attach delete handlers
        container.querySelectorAll('.delete-split-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.handleDeleteSplit(id);
            });
        });
    }

    updateSplitLimitUI() {
        const limitInput = document.getElementById('splitLimitInput');
        if (limitInput) {
            limitInput.value = this.oweLimit !== null && !isNaN(this.oweLimit) ? this.oweLimit : '';
        }
    }

    // Keep backwards-compatible helper if needed elsewhere
    getTotalOwedAmount() {
        return this.splits.filter(s => s.type === 'owed').reduce((sum, split) => sum + split.amount, 0);
    }

    async handleDeleteTransaction(idStr) {
        if (!this.currentUser || !this.currentUser.userId) {
            this.showNotification('Please login first', 'error');
            return;
        }

        // Find actual id type in local cache
        const tx = this.transactions.find(t => String(t.id) === String(idStr));
        const id = tx ? tx.id : idStr;

        try {
            await this.db.deleteTransaction(this.currentUser.userId, id);
            // Remove from local cache
            this.transactions = this.transactions.filter(t => String(t.id) !== String(id));
            // Update localStorage fallback
            try { localStorage.setItem('expenseTrackerTransactions', JSON.stringify(this.transactions)); } catch {}
            this.updateDashboard();
            this.renderTransactions();
            this.showNotification('Transaction deleted', 'success');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.showNotification('Transaction deleted', 'success');
        }
    }

    async handleDeleteSplit(idStr) {
        if (!this.currentUser || !this.currentUser.userId) {
            this.showNotification('Please login first', 'error');
            return;
        }

        // Find actual id in local cache
        const sp = this.splits.find(s => String(s.id) === String(idStr));
        const id = sp ? sp.id : idStr;

        try {
            // Delete from DB if possible
            try {
                await this.db.deleteSplit(this.currentUser.userId, id);
            } catch (err) {
                // If DB delete not found, continue to update local representation
                console.warn('DB deleteSplit warning:', err && err.message);
            }

            // Update local cache and persist
            this.splits = this.splits.filter(s => String(s.id) !== String(id));
            await this.saveSplitData();
            this.renderSplitSummary();
            this.showNotification('Split entry deleted', 'success');
        } catch (error) {
            console.error('Error deleting split:', error);
            this.showNotification('Failed to delete split', 'error');
        }
    }

    /**
     * Return the most recent transactions (newest first).
     * @param {number} count - max number of transactions to return
     */
    getRecentTransactions(count = 50) {
        if (!Array.isArray(this.transactions) || !this.transactions.length) return [];
        return [...this.transactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, count);
    }

     isOweLimitExceeded() {
         return this.oweLimit !== null && !isNaN(this.oweLimit) && this.getTotalOwedAmount() > this.oweLimit;
     }

    // Share functionality
    shareAsText() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        const balance = totalIncome - totalExpenses;

        const totalOwedToYou = this.splits.filter(s => s.type === 'owed').reduce((s, p) => s + p.amount, 0);
        const totalYouOwe = this.splits.filter(s => s.type === 'owe').reduce((s, p) => s + p.amount, 0);

        const parts = [];
        parts.push('Expense Tracker Report');
        parts.push('=======================');
        parts.push(`Generated: ${new Date().toLocaleString()}`);
        parts.push('');
        parts.push('Summary:');
        parts.push(`- Total Income: ${this.formatCurrency(totalIncome)}`);
        parts.push(`- Total Expenses: ${this.formatCurrency(totalExpenses)}`);
        parts.push(`- Balance: ${this.formatCurrency(balance)}`);
        parts.push(`- Savings Rate: ${totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0}%`);
        parts.push(`- People owe you: ${this.formatCurrency(totalOwedToYou)}`);
        parts.push(`- You owe others: ${this.formatCurrency(totalYouOwe)}`);
        parts.push('');
        parts.push('Recent Transactions:');

        const recent = this.getRecentTransactions(50);
        if (!recent.length) {
            parts.push('  No recent transactions.');
        } else {
            recent.forEach(tx => {
                const dt = this.formatDate(tx.date || tx.createdAt || new Date().toISOString());
                const desc = tx.description ? ` - ${tx.description}` : '';
                const cat = tx.category ? ` [${this.getCategoryName ? this.getCategoryName(tx.category) : tx.category}]` : '';
                parts.push(`  ${dt} | ${tx.type === 'income' ? '+' : '-'}${this.formatCurrency(tx.amount)} | ${tx.title || tx.name || 'Transaction'}${cat}${desc}`);
            });
        }

        const reportText = parts.join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(reportText).then(() => {
                this.showNotification('Report copied to clipboard!', 'success');
            }).catch(() => {
                this.showNotification('Failed to copy report', 'error');
            });
        } else {
            const w = window.open('', '_blank');
            if (w) {
                w.document.write(`<pre>${reportText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>`);
                w.document.title = 'ExpenseTracker Report';
            } else {
                this.showNotification('Unable to open report window', 'error');
            }
        }
    }

    shareAsImage() {
        // Create a canvas element to generate image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 800;
        canvas.height = 600;
        
        // Background
        ctx.fillStyle = this.isDarkMode ? '#0f172a' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = this.isDarkMode ? '#f8fafc' : '#1e293b';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Expense Tracker Report', canvas.width / 2, 60);
        
        // Date
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, canvas.width / 2, 90);
        
        // Summary
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        const balance = totalIncome - totalExpenses;
        
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Summary:', 50, 150);
        
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(`Total Income: ${this.formatCurrency(totalIncome)}`, 50, 180);
        ctx.fillText(`Total Expenses: ${this.formatCurrency(totalExpenses)}`, 50, 200);
        ctx.fillText(`Balance: ${this.formatCurrency(balance)}`, 50, 220);
        ctx.fillText(`Savings Rate: ${totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0}%`, 50, 240);
        
        // Convert to blob and download
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expense-report-${new Date().toISOString().split('T')[0]}.png`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Image report downloaded!', 'success');
        });
    }

    shareAsEmail() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        const balance = totalIncome - totalExpenses;
        const totalOwedToYou = this.splits.filter(s => s.type === 'owed').reduce((s, p) => s + p.amount, 0);
        const totalYouOwe = this.splits.filter(s => s.type === 'owe').reduce((s, p) => s + p.amount, 0);

        const parts = [];
        parts.push(`ExpenseTracker Report - ${new Date().toLocaleString()}`);
        parts.push('');
        parts.push('Summary:');
        parts.push(`- Total Income: ${this.formatCurrency(totalIncome)}`);
        parts.push(`- Total Expenses: ${this.formatCurrency(totalExpenses)}`);
        parts.push(`- Balance: ${this.formatCurrency(balance)}`);
        parts.push(`- Savings Rate: ${totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0}%`);
        parts.push(`- People owe you: ${this.formatCurrency(totalOwedToYou)}`);
        parts.push(`- You owe others: ${this.formatCurrency(totalYouOwe)}`);
        parts.push('');
        parts.push('Recent Transactions:');

        const recent = this.getRecentTransactions(50);
        if (!recent.length) {
            parts.push('  No recent transactions.');
        } else {
            recent.forEach(tx => {
                const dt = this.formatDate(tx.date || tx.createdAt || new Date().toISOString());
                const desc = tx.description ? ` - ${tx.description}` : '';
                const cat = tx.category ? ` [${this.getCategoryName ? this.getCategoryName(tx.category) : tx.category}]` : '';
                parts.push(`  ${dt} | ${tx.type === 'income' ? '+' : '-'}${this.formatCurrency(tx.amount)} | ${tx.title || tx.name || 'Transaction'}${cat}${desc}`);
            });
        }

        const subject = encodeURIComponent('ExpenseTracker Report');
        const body = encodeURIComponent(parts.join('\n'));
        window.open(`mailto:?subject=${subject}&body=${body}`);
        this.showNotification('Email client opened!', 'success');
    }

    // Notification system
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : 'var(--primary-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExpenseTracker();
});

// Add some additional CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
    
    .recurring-badge {
        background: var(--primary-color);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 500;
        margin-top: 0.25rem;
        display: inline-block;
    }
    
    .description {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-top: 0.25rem;
    }
`;
document.head.appendChild(notificationStyles);
