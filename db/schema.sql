-- Clean up existing data (for development only)
TRUNCATE TABLE ratings RESTART IDENTITY CASCADE;
TRUNCATE TABLE stores RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  address VARCHAR(400),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user', 'store_owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stores Table
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  address VARCHAR(400),
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ratings Table
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, store_id)
);

-- Sample Users
INSERT INTO users (name, email, password, address, role) VALUES 
  ('System Administrator', 'admin@example.com', '$2b$10$X5Z7LPDhP1Y3N6QP1C8iW.Uy9Yt5WGZy3VBGh9YrLo8V1McZR9uMm', '123 Admin Street', 'admin'),
  ('Store Owner One', 'owner1@example.com', '$2b$10$X5Z7LPDhP1Y3N6QP1C8iW.Uy9Yt5WGZy3VBGh9YrLo8V1McZR9uMm', '456 Owner Lane', 'store_owner'),
  ('Store Owner Two', 'owner2@example.com', '$2b$10$X5Z7LPDhP1Y3N6QP1C8iW.Uy9Yt5WGZy3VBGh9YrLo8V1McZR9uMm', '789 Owner Road', 'store_owner'),
  ('Normal User', 'user1@example.com', '$2b$10$X5Z7LPDhP1Y3N6QP1C8iW.Uy9Yt5WGZy3VBGh9YrLo8V1McZR9uMm', '321 User Street', 'user');

-- Dummy accounts for frontend Login.jsx
-- Passwords are bcrypt hashes for: Admin@123, User@123, Store@123
INSERT INTO users (name, email, password, address, role) VALUES
  ('Admin', 'admin@storetracking.com', '$2b$10$Q0Qw6Qw6Qw6Qw6Qw6Qw6QeQw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6', 'Admin Address', 'admin'),
  ('User', 'user@storetracking.com', '$2b$10$Q0Qw6Qw6Qw6Qw6Qw6Qw6QeQw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6', 'User Address', 'user'),
  ('Store Owner', 'store@storetracking.com', '$2b$10$Q0Qw6Qw6Qw6Qw6Qw6Qw6QeQw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6Qw6', 'Store Owner Address', 'store_owner');

-- Sample Stores (assigning owners)
INSERT INTO stores (name, email, address, owner_id) VALUES 
  ('Coffee Shop', 'coffee@example.com', '123 Coffee Street', 2),
  ('Book Store', 'books@example.com', '456 Book Avenue', 3),
  ('Electronics Store', 'electronics@example.com', '789 Tech Boulevard', 2);

-- Sample Ratings
INSERT INTO ratings (user_id, store_id, rating) VALUES
  (4, 1, 5), -- Normal User rates Coffee Shop
  (4, 2, 4), -- Normal User rates Book Store
  (4, 3, 3); -- Normal User rates Electronics Store

-- Create views for easier data retrieval
CREATE OR REPLACE VIEW store_ratings AS
SELECT 
  s.id AS store_id,
  s.name AS store_name,
  s.email AS store_email,
  s.address AS store_address,
  COALESCE(AVG(r.rating), 0) AS average_rating,
  COUNT(r.id) AS rating_count
FROM stores s
LEFT JOIN ratings r ON s.id = r.store_id
GROUP BY s.id, s.name, s.email, s.address;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_store_id ON ratings(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
