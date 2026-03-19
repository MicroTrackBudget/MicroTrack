// Backend API URL - make sure server is running 
const API_URL = 'http://localhost:3000';


function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getUserId() {
    return localStorage.getItem('userId');
}

function getUserEmail() {
    return localStorage.getItem('userEmail');
}

function isLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true' && getUserId();
}

function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// AUTHENTICATION API

async function apiRegister(username, email, password) {
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        return { success: true, ...data };
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

async function apiLogin(email, password) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        // Store user info for session
        if (data.user) {
            localStorage.setItem('userId', data.user.user_id);
            localStorage.setItem('userEmail', data.user.email);
            localStorage.setItem('userName', data.user.username);
            localStorage.setItem('isLoggedIn', 'true');
        }
        
        return { success: true, user: data.user };
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

async function apiResetPassword(email, newPassword) {
    try {
        
        const response = await fetch(`${API_URL}/updatePassword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });
        
        if (!response.ok) {
            
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            if (users[email]) {
                users[email].password = newPassword;
                localStorage.setItem('users', JSON.stringify(users));
                return { success: true, message: 'Password updated (localStorage)' };
            }
            throw new Error('User not found');
        }
        
        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Password reset error:', error);
        throw error;
    }
}

function apiLogout() {
    localStorage.clear();
    window.location.href = 'index.html';
}


// BUDGET API
async function apiGetBudgets() {
    try {
        const userId = getUserId();
        if (!userId) throw new Error('Not logged in');
        
        const response = await fetch(`${API_URL}/budgets/${userId}`);
        const budgets = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to get budgets');
        }
        
        return budgets || [];
    } catch (error) {
        console.error('Get budgets error:', error);
        return [];
    }
}

async function apiCreateBudget(budgetName, categoryId, monthlyLimit, weeklyLimit) {
    try {
        const userId = getUserId();
        if (!userId) throw new Error('Not logged in');
        
        const response = await fetch(`${API_URL}/createBudget`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                budget_name: budgetName,
                monthly_limit: monthlyLimit,
                weekly_limit: weeklyLimit,
                user_id: userId,
                category_id: categoryId,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create budget');
        }
        
        return { success: true, ...data };
    } catch (error) {
        console.error('Create budget error:', error);
        throw error;
    }
}

async function apiDeleteBudget(budgetId) {
    try {
        
        console.warn('Delete budget endpoint not implemented yet');
        return { success: false, message: 'Feature not available yet' };
    } catch (error) {
        console.error('Delete budget error:', error);
        throw error;
    }
}


// TRANSACTION API
async function apiGetTransactions() {
    try {
        const userId = getUserId();
        if (!userId) throw new Error('Not logged in');
        
        const response = await fetch(`${API_URL}/transactions/${userId}`);
        const transactions = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to get transactions');
        }
        
        return transactions || [];
    } catch (error) {
        console.error('Get transactions error:', error);
        return [];
    }
}

async function apiAddTransaction(transactionData) {
    try {
        const userId = getUserId();
        if (!userId) throw new Error('Not logged in');
        
        
        const response = await fetch(`${API_URL}/addExpense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                budget_id: transactionData.budget_id,
                expense_amount: transactionData.transaction_amount,
                description: transactionData.item_name || 'Purchase'
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add transaction');
        }
        
        return { success: true, ...data };
    } catch (error) {
        console.error('Add transaction error:', error);
        throw error;
    }
}

async function apiDeleteTransaction(transactionId) {
    try {
        const response = await fetch(`${API_URL}/transaction/${transactionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete transaction');
        }
        
        return { success: true, ...data };
    } catch (error) {
        console.error('Delete transaction error:', error);
        throw error;
    }
}


// CATEGORIES API
async function apiGetCategories() {
   
    return [
        { category_id: 1, category_name: 'Food', emoji: '🍕' },
        { category_id: 2, category_name: 'Clothing', emoji: '👕' },
        { category_id: 3, category_name: 'Entertainment', emoji: '🎬' },
        { category_id: 4, category_name: 'Electronics', emoji: '📱' }
    ];
}

// UTILITY FUNCTIONS
function showLoading(message = 'Loading...') {
    console.log(message);
}

function hideLoading() {
    console.log('Loading complete');
}

function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

// Calculate monthly spending from transactions
function calculateMonthlySpending(transactions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return transactions
        .filter(t => {
            const date = new Date(t.transaction_date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + parseFloat(t.transaction_amount), 0);
}

// Calculate weekly spending from transactions
function calculateWeeklySpending(transactions) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return transactions
        .filter(t => new Date(t.transaction_date) >= oneWeekAgo)
        .reduce((sum, t) => sum + parseFloat(t.transaction_amount), 0);
}

// Calculate budget remaining
function calculateBudgetRemaining(budget, transactions) {
    const monthlySpent = calculateMonthlySpending(
        transactions.filter(t => t.category_id === budget.category_id)
    );
    
    return {
        monthly_limit: budget.monthly_limit,
        monthly_spent: monthlySpent,
        monthly_remaining: budget.monthly_limit - monthlySpent,
        percentage_used: (monthlySpent / budget.monthly_limit) * 100
    };
}
