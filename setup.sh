#!/bin/bash

# TaskFlow API Setup Script
# This script automates the complete setup process for new developers

set -e  # Exit on any error

echo "🚀 TaskFlow API Setup Script"
echo "============================="

# Check if required tools are installed
echo "📋 Checking prerequisites..."

if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first: https://bun.sh/"
    exit 1
fi

if ! command -v pg_isready &> /dev/null; then
    echo "❌ PostgreSQL is not installed or not in PATH. Please install PostgreSQL first."
    exit 1
fi

if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis CLI not found. Please ensure Redis is installed and running."
fi

echo "✅ Prerequisites check completed"

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "⚠️  Please update .env file with your database credentials before continuing"
        echo "   Database URL should be: postgresql://username:password@localhost:5432/taskflow"
        read -p "Press enter when you've updated the .env file..."
    else
        echo "⚠️  .env.example not found. Please create .env file manually"
        exit 1
    fi
else
    echo "✅ .env file already exists"
fi

# Check database connection
echo "🔌 Testing database connection..."
if pg_isready -d taskflow -h localhost -p 5432 -U postgres &> /dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Cannot connect to database. Please check:"
    echo "   1. PostgreSQL is running"
    echo "   2. Database 'taskflow' exists"
    echo "   3. Credentials in .env are correct"
    
    read -p "Do you want to create the database? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating database..."
        createdb -U postgres taskflow || {
            echo "❌ Failed to create database. Please create it manually:"
            echo "   psql -U postgres -c 'CREATE DATABASE taskflow;'"
            exit 1
        }
        echo "✅ Database created successfully"
    else
        exit 1
    fi
fi

# Build the application
echo "🏗️  Building TypeScript files..."
bun run build

# Run migrations
echo "📊 Running database migrations..."
bun run migration:run

# Seed database
echo "🌱 Seeding database with initial data..."
bun run seed

# Final verification
echo "🔍 Verifying setup..."
if bun run migration:show | grep -q "\[X\]"; then
    echo "✅ Database migrations completed"
else
    echo "❌ Some migrations may not have run correctly"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "🚀 You can now start the development server:"
echo "   bun run start:dev"
echo ""
echo "📚 API Documentation will be available at:"
echo "   http://localhost:3000/api"
echo ""
echo "👤 Default users:"
echo "   Admin: admin@example.com / admin123"
echo "   User:  user@example.com / user123"
echo ""
echo "🔒 Security features enabled:"
echo "   - JWT with refresh token rotation (15min expiry)"
echo "   - Rate limiting (Redis-based)"
echo "   - IP tracking and security monitoring"
echo "   - Role-based authorization"
echo "   - Input validation and sanitization"
