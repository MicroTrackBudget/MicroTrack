CREATE DATABASE BudgetApp;
USE BudgetApp;

CREATE TABLE Users
(
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE SpendCategory
(
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL
);

CREATE TABLE Budget
(
  budget_id INT AUTO_INCREMENT PRIMARY KEY,
  monthly_limit DECIMAL(10,2),
  weekly_limit DECIMAL(10,2),
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(user_id),
  FOREIGN KEY (category_id) REFERENCES SpendCategory(category_id)
);

CREATE TABLE Transactions
(
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_amount DECIMAL(10,2) NOT NULL,
  transaction_date DATE NOT NULL,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(user_id),
  FOREIGN KEY (category_id) REFERENCES SpendCategory(category_id)
);

CREATE TABLE Product
(
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(100) NOT NULL,
  store_location VARCHAR(100)
);

CREATE TABLE PriceHistory
(
  price_id INT AUTO_INCREMENT PRIMARY KEY,
  price DECIMAL(10,2) NOT NULL,
  price_date DATE NOT NULL,
  product_id INT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES Product(product_id)
);

-- Users
INSERT INTO Users (username, email, password)
VALUES
('luis123', 'luis@email.com', 'pass123'),
('ariel456', 'ariel@email.com', 'pass456');

-- Categories
INSERT INTO SpendCategory (category_name)
VALUES ('Food'), ('Clothing'), ('Entertainment'), ('Electronics');

-- Budget
INSERT INTO Budget (monthly_limit, weekly_limit, user_id, category_id)
VALUES
(500.00, 125.00, 1, 1),
(300.00, 75.00, 1, 2),
(800.00, 200.00, 2, 4);

-- Transactions
INSERT INTO Transactions (transaction_amount, transaction_date, user_id, category_id)
VALUES
(25.50, '2026-02-01', 1, 1),
(60.00, '2026-02-03', 1, 2),
(199.99, '2026-02-05', 2, 4);

-- Products
INSERT INTO Product (product_name, store_location)
VALUES
('Nike Hoodie', 'Chicago'),
('AirPods', 'Best Buy');

-- Price History
INSERT INTO PriceHistory (price, price_date, product_id)
VALUES
(59.99, '2026-01-15', 1),
(49.99, '2026-02-01', 1),
(199.99, '2026-02-05', 2);
