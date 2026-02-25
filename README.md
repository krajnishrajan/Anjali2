# ExpenseTracker Pro

A modern, feature-rich web application for tracking expenses, managing income, and splitting bills with friends and family. Built with vanilla JavaScript, CSS3, and IndexedDB for offline-first local data storage.

## Project Overview

ExpenseTracker Pro is a comprehensive personal finance management system designed to help users track their spending, manage income, analyze financial reports, and split expenses with others. The application features a modern UI with dark mode support, real-time analytics, and secure user authentication.

## File Structure

```
Expense Management System/
├── index.html          # Main HTML markup - Login UI and app interface
├── script.js           # Core application logic and event handling
├── styles.css          # Complete styling with themes and responsive design
├── database.js         # IndexedDB database manager and persistence layer
└── README.md           # Project documentation (this file)
```

## Files Description

### 1. **index.html** (479 lines)
Main HTML file containing the complete UI structure for the application.

**Key Components:**
- **Login Screen**: User authentication interface with username/password fields
- **Main App Container**: Dashboard with statistics and navigation
- **Dashboard Cards**: Display total income, expenses, balance, and savings rate
- **Action Buttons**: Quick access to add expenses, income, view reports, and split bills
- **Transactions List**: Display recent transactions with filtering options (All, Income, Expenses)
- **Split Overview**: Manage bill splits showing who owes whom
- **Modal Forms**:
  - Add Expense Modal
  - Add Income Modal
  - Share/Reports Modal
  - User Profile Modal
  - Split Bills Modal

**External Dependencies:**
- Font Awesome 6.0.0 (Icons)
- Google Fonts - Inter font family

### 2. **script.js** (1,767 lines)
Main JavaScript application logic containing the ExpenseTracker class.

**Core Features:**
- **Authentication System**: Login/Register with password hashing
- **Transaction Management**: Add, delete, and filter income/expense transactions
- **Recurring Transactions**: Setup monthly recurring income and expenses
- **Bill Splitting**: Create splits between multiple people with even or manual distribution
- **Dashboard Analytics**: Calculate and display financial metrics (total income, expenses, balance, savings rate)
- **Theme Management**: Toggle between light and dark modes
- **Reporting & Sharing**: Generate reports and share expense summaries as text, images, or email
- **Data Persistence**: Automatic saving to IndexedDB with localStorage fallback
- **Currency Support**: Support for multiple currencies (USD, EUR, GBP, JPY, INR, CAD, AUD, CNY, MXN, BRL)
- **User Profiles**: Avatar upload and user settings
- **Data Migration**: Automatic migration from localStorage to IndexedDB

**Key Classes & Methods:**
- `ExpenseTracker` - Main application class
- `init()` - Initialize the application
- `handleLogin()` - Process user login
- `handleAddExpense()` - Add new expense transaction
- `handleAddIncome()` - Add new income transaction
- `handleAddSplit()` - Create bill split
- `updateDashboard()` - Update financial statistics
- `renderTransactions()` - Render transaction list
- `renderSplitSummary()` - Render split overview
- `toggleTheme()` - Switch between light/dark modes

### 3. **styles.css** (1,350 lines)
Complete styling system with responsive design and theme support.

**Key Features:**
- **CSS Variables**: Comprehensive theme system with light and dark modes
- **Color Scheme**:
  - Primary: Indigo (#6366f1)
  - Secondary: Pink (#ec4899)
  - Success: Green (#10b981)
  - Warning: Amber (#f59e0b)
  - Error: Red (#ef4444)
- **Responsive Design**: Mobile-first approach with breakpoints for tablets and desktops
- **Components Styled**:
  - Login card with gradient background
  - Dashboard stat cards
  - Transaction list items
  - Modal dialogs
  - Form inputs and controls
  - Split bill interface
  - Profile section
  - Navigation headers and buttons
- **Animations**: Smooth transitions, hover effects, and floating animations
- **Gradients**: Multiple gradient options for visual hierarchy

### 4. **database.js** (506 lines)
IndexedDB database manager for persistent data storage.

**Database Schema:**
- **users**: Store user accounts with authentication
  - Indexes: userId, loginTime
- **transactions**: Store income and expense records
  - Indexes: userId, type, date, userId_date
- **recurringTransactions**: Store recurring income/expenses
  - Indexes: userId, type
- **splits**: Store bill split records
  - Indexes: userId, date
- **userSettings**: Store user preferences
  - Keypath: userId

**Key Methods:**
- `init()` - Initialize IndexedDB with schema
- `hashPassword()` - Hash passwords using SHA-256
- `registerUser()` - Create new user account
- `authenticateUser()` - Verify login credentials
- `saveTransaction()` - Store transaction record
- `getTransactions()` - Retrieve transactions by userId
- `saveSplit()` - Store split record
- `getSplits()` - Retrieve split records

**Features:**
- Automatic database initialization on first run
- Schema migration support
- Password hashing for security
- User ID generation
- Transaction management with filtering
- Recurring transaction handling
- Split tracking with user relationships

## Key Features

✨ **Modern UI/UX**
- Clean, intuitive interface with professional design
- Dark mode support for comfortable viewing
- Responsive layout for mobile, tablet, and desktop
- Font Awesome icons throughout

💰 **Financial Tracking**
- Add and categorize expenses
- Track income from various sources
- Real-time balance calculation
- Savings rate percentage display

🔁 **Recurring Transactions**
- Setup monthly recurring expenses (rent, EMI, subscriptions)
- Setup recurring income (salary, freelance work)
- Automatic processing of recurring transactions

👥 **Bill Splitting**
- Create splits between multiple people
- Even split distribution
- Manual amount assignment
- Track who owes you and what you owe
- Set owe limits for notifications

📊 **Reports & Analytics**
- View recent transactions
- Filter by transaction type
- Generate expense reports
- Share reports as text, image, or email

🔐 **Security & Authentication**
- User registration and login
- Password hashing with SHA-256
- User profiles with avatar support
- Session management

💾 **Data Management**
- Offline-first with IndexedDB
- Automatic data synchronization
- Data persistence across sessions
- Automatic migration from localStorage

🌍 **Multi-Currency Support**
- Support for 10+ currencies
- Automatic currency conversion display
- User preference persistence

## Getting Started

### Prerequisites
- Modern web browser with JavaScript enabled
- IndexedDB support (all modern browsers)

### Installation

1. Clone or download the project
2. Open `index.html` in a web browser
3. Create a user account or login

### First-Time Setup

1. **Create Account**: Click "Register" on the login screen
2. **Enter Credentials**: Choose a username and password
3. **Login**: Use your credentials to access the app
4. **Setup Profile**: 
   - Upload an avatar
   - Select preferred currency
   - Configure owe limit for splits

## Usage

### Adding Transactions

**Expense:**
1. Click "Add Expense" button
2. Enter title, amount, and category
3. Select date
4. Optionally mark as recurring monthly
5. Click "Add Expense"

**Income:**
1. Click "Add Income" button
2. Enter title, amount, and income type
3. Select date
4. Optionally mark as recurring monthly
5. Click "Add Income"

### Creating Bill Splits

1. Click "Split" button
2. Enter split title and total amount
3. Add counterparties (people involved)
4. Choose split method:
   - Even: Automatically divide equally
   - Manual: Specify exact amounts
5. Select date
6. Optionally add notes
7. Indicate who paid
8. Click "Save Split"

### Viewing Reports

1. Click "View Reports" or share button
2. Select sharing option:
   - Copy text report
   - Generate image
   - Email report
3. Share or copy the report

### Managing Settings

1. Click profile avatar in top right
2. Update profile photo
3. Change currency
4. View user ID
5. Click "Logout" to end session

## Technology Stack

**Frontend:**
- HTML5
- CSS3 (with CSS Variables for theming)
- Vanilla JavaScript (ES6+)

**Storage:**
- IndexedDB (primary)
- localStorage (fallback for backwards compatibility)

**External Libraries:**
- Font Awesome 6.0.0 (Icons)
- Google Fonts (Inter typeface)

**Security:**
- SHA-256 password hashing
- Client-side authentication

## Data Storage

All data is stored locally in your browser using IndexedDB. This means:
- ✅ No data sent to external servers
- ✅ Works completely offline
- ✅ Data persists between sessions
- ✅ Private and secure

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Opera: Full support
- IE11: Not supported (requires ES6)

## Categories

**Expense Categories:**
- House Rent
- EMI / Loan
- Food & Dining
- Transportation
- Shopping
- Entertainment
- Bills & Utilities
- Healthcare
- Education
- Other

**Income Types:**
- Salary
- Freelance
- Investment
- Business
- Other

## Supported Currencies

USD, EUR, GBP, JPY, INR, CAD, AUD, CNY, MXN, BRL

## Performance Considerations

- Lightweight: No heavy dependencies
- Fast: IndexedDB for instant data access
- Responsive: Optimized rendering with CSS animations
- Scalable: Handles thousands of transactions efficiently

## Tips & Best Practices

1. **Regular Backups**: Export data regularly for backup
2. **Monthly Review**: Check your reports monthly
3. **Set Limits**: Use owe limit for split notifications
4. **Recurring Setup**: Configure recurring transactions once
5. **Currency Consistency**: Use same currency for all entries

## Troubleshooting

**Data Not Saving:**
- Check browser storage quota
- Ensure IndexedDB is enabled
- Try clearing browser cache and reload

**Login Issues:**
- Verify username and password are correct
- Check if account exists
- Try a different browser if issues persist

**Display Issues:**
- Clear browser cache
- Ensure JavaScript is enabled
- Update browser to latest version

## Future Enhancements

Potential features for future versions:
- Cloud synchronization
- Budget planning
- Spending analytics with charts
- CSV export
- Receipt scanning
- Multi-account support
- Mobile app version

## License

This project is provided as-is for personal use.

## Support

For issues or questions, review the code documentation and comments throughout the files.

---