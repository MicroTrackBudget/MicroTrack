–- Total monthly Spending Query (Per user, per category):
SELECT 
    SUM(transaction_amount) AS total_month_spent
FROM Transactions
WHERE user_id = 1
AND category_id = 1
AND MONTH(transaction_date) = MONTH(CURDATE())
AND YEAR(transaction_date) = YEAR(CURDATE());

–- Total monthly spent (per user, all categories):
SELECT 
    SUM(transaction_amount) AS total_month_spent
FROM Transactions
WHERE user_id = 1
AND MONTH(transaction_date) = MONTH(CURDATE())
AND YEAR(transaction_date) = YEAR(CURDATE());

–- Get total weekly spending (per user, per category):
SELECT 
    SUM(transaction_amount) AS total_week_spent
FROM Transactions
WHERE user_id = 1
AND category_id = 1
AND YEARWEEK(transaction_date, 1) = YEARWEEK(CURDATE(), 1);

–- Get total weekly spending (per user, no category):
SELECT 
    SUM(transaction_amount) AS total_week_spent
FROM Transactions
WHERE user_id = 1
AND YEARWEEK(transaction_date, 1) = YEARWEEK(CURDATE(), 1);

–- Get user budget:
SELECT monthly_limit, weekly_limit
FROM Budget
WHERE user_id = 1
AND category_id = 1;

–- Calculate remaining budget (monthy):
SELECT 
    b.monthly_limit,
    IFNULL(SUM(t.transaction_amount), 0) AS total_spent,
    (b.monthly_limit - IFNULL(SUM(t.transaction_amount), 0)) AS remaining_balance
FROM Budget b
LEFT JOIN Transactions t 
    ON b.user_id = t.user_id 
    AND b.category_id = t.category_id
    AND MONTH(t.transaction_date) = MONTH(CURDATE())
    AND YEAR(t.transaction_date) = YEAR(CURDATE())
WHERE b.user_id = 1
AND b.category_id = 1
GROUP BY b.monthly_limit;


–- Calculate remaining budget (weekly):
SELECT 
    b.weekly_limit,
    IFNULL(SUM(t.transaction_amount), 0) AS total_spent,
    (b.weekly_limit - IFNULL(SUM(t.transaction_amount), 0)) AS remaining_balance
FROM Budget b
LEFT JOIN Transactions t 
    ON b.user_id = t.user_id 
    AND b.category_id = t.category_id
    AND YEARWEEK(t.transaction_date, 1) = YEARWEEK(CURDATE(), 1)
WHERE b.user_id = 1
AND b.category_id = 1
GROUP BY b.weekly_limit;
