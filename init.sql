-- PostgreSQL initialization script for Loko Backend
-- This script will be executed when the PostgreSQL container starts for the first time

-- Create database if not exists (already handled by POSTGRES_DB environment variable)
-- CREATE DATABASE IF NOT EXISTS loko_db;

-- Create user if not exists (already handled by POSTGRES_USER environment variable)
-- CREATE USER IF NOT EXISTS loko_user WITH PASSWORD 'loko_password';

-- Grant privileges to user (already handled by PostgreSQL default behavior)
-- GRANT ALL PRIVILEGES ON DATABASE loko_db TO loko_user;

-- Set timezone
SET timezone = 'UTC';

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema if needed
-- CREATE SCHEMA IF NOT EXISTS loko;

-- Log successful initialization
SELECT 'PostgreSQL database initialized successfully for Loko Backend' AS status;