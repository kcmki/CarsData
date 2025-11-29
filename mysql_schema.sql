-- MySQL schema for the collector
-- Compatible with MySQL 8.0+

CREATE DATABASE IF NOT EXISTS cars_collector CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cars_collector;

-- LBC ads table
CREATE TABLE IF NOT EXISTS ads_lbc (
  unique_key VARCHAR(255) PRIMARY KEY,
  list_id BIGINT,
  url TEXT,
  subject TEXT,
  body TEXT,
  category_id VARCHAR(100),
  category_name VARCHAR(255),
  ad_type VARCHAR(50),
  status VARCHAR(50),
  price_cents BIGINT,
  price DECIMAL(12,2),
  first_publication_date VARCHAR(50),
  expiration_date VARCHAR(50),
  index_date VARCHAR(50),
  has_phone BOOLEAN,
  -- images
  images_nb INT,
  images_thumb_url TEXT,
  images_small_url TEXT,
  images_urls JSON,
  images_urls_thumb JSON,
  images_urls_large JSON,
  -- location
  location_country_id VARCHAR(10),
  location_region_id VARCHAR(50),
  location_region_name VARCHAR(255),
  location_department_id VARCHAR(50),
  location_department_name VARCHAR(255),
  location_city VARCHAR(255),
  location_zipcode VARCHAR(20),
  location_lat DOUBLE,
  location_lng DOUBLE,
  -- owner
  owner_store_id VARCHAR(100),
  owner_user_id VARCHAR(100),
  owner_type VARCHAR(50),
  owner_name VARCHAR(255),
  -- attributes main
  car_brand VARCHAR(255),
  car_model VARCHAR(255),
  regdate VARCHAR(50),
  mileage INT,
  fuel_label VARCHAR(255),
  gearbox_label VARCHAR(255),
  doors INT,
  seats INT,
  issuance_date VARCHAR(50),
  vehicle_type VARCHAR(255),
  vehicule_color VARCHAR(255),
  critair INT,
  horsepower_fiscal INT,
  horsepower_din INT,
  -- raw payload for reference
  raw JSON,
  first_seen_at VARCHAR(50),
  updated_at VARCHAR(50),
  INDEX idx_brand (car_brand),
  INDEX idx_model (car_model),
  INDEX idx_price (price),
  INDEX idx_regdate (regdate),
  INDEX idx_first_pub (first_publication_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mobile.de ads table
CREATE TABLE IF NOT EXISTS ads_mobilede (
  unique_key VARCHAR(255) PRIMARY KEY,
  list_id BIGINT,
  url TEXT,
  subject TEXT,
  body TEXT,
  category_id VARCHAR(100),
  category_name VARCHAR(255),
  ad_type VARCHAR(50),
  status VARCHAR(50),
  price_cents BIGINT,
  price DECIMAL(12,2),
  first_publication_date VARCHAR(50),
  expiration_date VARCHAR(50),
  index_date VARCHAR(50),
  has_phone BOOLEAN,
  -- images
  images_nb INT,
  images_thumb_url TEXT,
  images_small_url TEXT,
  images_urls JSON,
  images_urls_thumb JSON,
  images_urls_large JSON,
  -- location
  location_country_id VARCHAR(10),
  location_region_id VARCHAR(50),
  location_region_name VARCHAR(255),
  location_department_id VARCHAR(50),
  location_department_name VARCHAR(255),
  location_city VARCHAR(255),
  location_zipcode VARCHAR(20),
  location_lat DOUBLE,
  location_lng DOUBLE,
  -- owner
  owner_store_id VARCHAR(100),
  owner_user_id VARCHAR(100),
  owner_type VARCHAR(50),
  owner_name VARCHAR(255),
  -- attributes main
  car_brand VARCHAR(255),
  car_model VARCHAR(255),
  regdate VARCHAR(50),
  mileage INT,
  fuel_label VARCHAR(255),
  gearbox_label VARCHAR(255),
  doors INT,
  seats INT,
  issuance_date VARCHAR(50),
  vehicle_type VARCHAR(255),
  vehicule_color VARCHAR(255),
  critair INT,
  horsepower_fiscal INT,
  horsepower_din INT,
  -- raw payload for reference
  raw JSON,
  first_seen_at VARCHAR(50),
  updated_at VARCHAR(50),
  INDEX idx_brand (car_brand),
  INDEX idx_model (car_model),
  INDEX idx_price (price),
  INDEX idx_regdate (regdate),
  INDEX idx_first_pub (first_publication_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Runs tracking table
CREATE TABLE IF NOT EXISTS runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(100),
  started_at VARCHAR(50),
  finished_at VARCHAR(50),
  attempts INT,
  success BOOLEAN,
  count_scraped INT,
  stats JSON,
  error TEXT,
  INDEX idx_finished (finished_at),
  INDEX idx_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
