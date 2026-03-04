CREATE TABLE `Budget` (
  `budget_id` int NOT NULL AUTO_INCREMENT,
  `monthly_limit` decimal(10,2) DEFAULT NULL,
  `weekly_limit` decimal(10,2) DEFAULT NULL,
  `user_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`budget_id`),
  KEY `user_id` (`user_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `budget_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`user_id`),
  CONSTRAINT `budget_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `SpendCategory` (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `PriceHistory` (
  `price_id` int NOT NULL AUTO_INCREMENT,
  `price` decimal(10,2) NOT NULL,
  `price_date` date NOT NULL,
  `product_id` int NOT NULL,
  PRIMARY KEY (`price_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `pricehistory_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `Product` (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Product` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `product_name` varchar(100) NOT NULL,
  `store_location` varchar(100) DEFAULT NULL,
  `user_id` int NOT NULL,
  `product_url` varchar(2048) DEFAULT NULL,
  `target_price` decimal(10,2) DEFAULT NULL,
  `current_price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`product_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `product_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `SpendCategory` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(50) NOT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Transactions` (
  `transaction_id` int NOT NULL AUTO_INCREMENT,
  `transaction_amount` decimal(10,2) NOT NULL,
  `transaction_date` date NOT NULL,
  `user_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `user_id` (`user_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`user_id`),
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `SpendCategory` (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


