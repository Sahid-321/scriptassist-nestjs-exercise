
# TaskFlow API - Distributed Systems & Reliability Demo

## Project Overview

This repository demonstrates a solution to the TaskFlow API challenge. The codebase has been refactored and enhanced to address advanced distributed systems, reliability, security, and performance requirements. This README is tailored for review and demonstration.

**Key Points:**
- All advanced distributed systems and reliability features are implemented as injectable NestJS services (see `src/common/services/`).
- The project is ready for multi-instance, production-grade deployment.
- The Getting Started section below will let you run and verify all features locally.

---

## Tech Stack

- **Language**: TypeScript
- **Framework**: NestJS
- **ORM**: TypeORM with PostgreSQL
- **Queue System**: BullMQ with Redis
- **API Style**: REST with JSON
- **Package Manager**: Bun
- **Testing**: Bun test

## Getting Started

### Prerequisites

- Node.js (v16+)
- Bun (latest version)
- PostgreSQL
- Redis

### Setup Instructions

**Quick Setup (Recommended)**

For a fully automated setup, run our setup script:
```bash
./setup.sh
```

This script will:
- Check all prerequisites
- Install dependencies
- Set up environment variables
- Create and migrate the database
- Seed initial data
- Verify the installation

**Manual Setup**

If you prefer manual setup or need to troubleshoot:

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Configure environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   # Update the .env file with your database and Redis connection details
   ```
4. Database Setup:
   
   Ensure your PostgreSQL database is running, then create a database:
   ```bash
   # Using psql
   psql -U postgres
   CREATE DATABASE taskflow;
   \q
   
   # Or using createdb
   createdb -U postgres taskflow
   ```
   
   Build the TypeScript files to ensure the migrations can be run:
   ```bash
   bun run build
   ```

5. Run database migrations:
   ```bash
   # Option 1: Standard migration (recommended)
   bun run migration:run
   
   # Option 2: Force table creation with our custom script
   bun run migration:custom
   ```
   
   Our migration system will automatically:
   - Create all necessary tables (users, tasks, refresh_tokens)
   - Set up proper indexes for performance
   - Create foreign key relationships
   - Add security-related columns and constraints
   - Handle both fresh installations and existing databases

6. Seed the database with initial data:
   ```bash
   bun run seed
   ```
   
7. Start the development server:
   ```bash
   bun run start:dev
   ```

### Troubleshooting Database Issues

If you continue to have issues with database connections:

1. Check that PostgreSQL is properly installed and running:
   ```bash
   # On Linux/Mac
   systemctl status postgresql
   # or
   pg_isready
   
   # On Windows
   sc query postgresql
   ```

2. Verify your database credentials by connecting manually:
   ```bash
   psql -h localhost -U postgres -d taskflow
   ```

3. If needed, manually create the schema from the migration files:
   - Look at the SQL in `src/database/migrations/`
   - Execute the SQL manually in your database

### Default Users

The seeded database includes two users:

1. Admin User:
   - Email: admin@example.com
   - Password: admin123
   - Role: admin

2. Regular User:
   - Email: user@example.com
   - Password: user123
   - Role: user



## What’s New: Advanced Distributed Systems & Reliability Features

The following features were added to make the system robust, scalable, and production-ready. **You can verify these by reviewing the code in `src/common/services/` and by running the project as described below.**

| Feature                        | Description & How to Verify |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Distributed Cache with Invalidation | Redis-based cache with pub/sub invalidation. See `RedisCacheService` and test with multiple app instances. |
| Distributed Locking            | Redlock-based distributed locks for safe concurrent operations. See `RedisCacheService.acquireLock`/`releaseLock`. |
| Circuit Breakers               | Opossum-based circuit breakers for all external calls. See `CircuitBreakerService` and usage in services. |
| Self-Healing Mechanisms        | Automated recovery actions on circuit breaker events. See `SelfHealingService` and its registration methods. |
| Fault Isolation Boundaries     | Each external dependency/critical section is isolated with its own circuit breaker. See `FaultIsolationService`. |
| Backpressure Mechanisms        | Async operations protected with concurrency/queue limits. See `BackpressureService` and wrap any async function. |
| Efficient Resource Utilization | Monitors/logs memory, CPU, event loop; health checks for memory/loop lag. See `ResourceUtilizationService`. |
| Predictable Performance        | Async ops can be wrapped with timeouts/rate limits. See `PredictablePerformanceService`. |


All features are injectable and ready for use in any module. **For demonstration, you can inject these services into controllers or other services and observe their effects in logs and behavior.**

---


## Solution Analysis & Rationale

### 1. Analysis of Core Problems

- **Scalability**: In-memory caching, rate limiting, and stateful logic would break in multi-instance deployments.
- **Reliability**: No circuit breakers, retries, or self-healing; failures could cascade and bring down the system.
- **Performance**: Inefficient queries, lack of batching, and no backpressure could cause slowdowns and resource exhaustion.
- **Security**: Weak authentication, missing input validation, and improper error handling exposed the system to attacks.
- **Observability**: No health checks, metrics, or structured logging for diagnosing issues in production.

### 2. Architectural Approach

- **Service-Oriented**: All advanced features are implemented as injectable, reusable NestJS services.
- **Distributed-Ready**: Redis is used for distributed cache, locks, and rate limiting; all stateful logic is externalized.
- **Resilience Patterns**: Circuit breakers, self-healing, and fault isolation are applied to all external dependencies.
- **Backpressure & Predictability**: Async operations are protected with concurrency, queue, timeout, and rate limit wrappers.
- **Observability**: Health checks, resource monitoring, and structured logs are integrated for production diagnostics.

### 3. Performance & Security Improvements

- **Performance**: Bulk DB operations, indexed queries, efficient filtering/pagination, and distributed cache for hot data.
- **Security**: JWT with refresh rotation, role/permission guards, input sanitization, secure error handling, and strong password storage.
- **Distributed Rate Limiting**: Redis-backed, per-endpoint, with clear error responses.
- **Resource Efficiency**: Monitors and enforces memory, CPU, and event loop health.

### 4. Key Technical Decisions & Rationale

- **Redis for State**: Chosen for distributed cache, locks, and rate limiting due to its speed and reliability in multi-instance setups.
- **Opossum for Circuit Breakers**: Provides proven, production-grade circuit breaker logic for all async operations.
- **Service Injection**: All reliability features are injectable, so they can be composed and tested independently.
- **CQRS Pattern**: Used for clear separation of command/query logic and to enable future event sourcing.
- **TypeScript & NestJS**: For type safety, modularity, and rapid development.

### 5. Tradeoffs Made

- **Complexity vs. Robustness**: Added complexity (e.g., distributed locks, circuit breakers) for true production resilience.
- **Redis Dependency**: Relies on Redis for distributed features; single-node Redis is a SPOF unless clustered.
- **Opossum Overhead**: Circuit breaker logic adds some latency but prevents catastrophic failures.
- **Manual Service Registration**: All advanced features are explicit providers for clarity, but could be auto-registered in a larger system.

---

The application includes comprehensive security enhancements:

### Enhanced Authentication
- **JWT with Refresh Token Rotation**: Short-lived access tokens (15 minutes) with secure refresh token rotation
- **IP Address Tracking**: Monitors login locations for security breach detection
- **User Agent Validation**: Tracks device/browser information for additional security
- **Security Breach Detection**: Automatically detects suspicious login patterns

### Rate Limiting
- **Redis-based Distributed Rate Limiting**: Configurable rate limits per endpoint
- **Different Limits per Endpoint**: Login (5/min), Refresh (10/min), General API (100/min)
- **IP-based Tracking**: Privacy-compliant hashed IP storage
- **Proper Error Responses**: Clear rate limit headers and retry information

### Authorization & Permissions
- **Role-based Access Control**: Admin, Manager, and User roles with different permissions
- **Permission-based Endpoints**: Fine-grained access control per route
- **Multi-level Authorization**: Guards at both route and method level

### Data Protection
- **Input Sanitization**: XSS and SQL injection prevention
- **Secure Error Handling**: No sensitive data leakage in error responses
- **Security Headers**: CORS, CSP, and other security headers automatically applied
- **Data Validation**: Comprehensive input validation with sanitization

### Database Security
- **Secure Password Storage**: bcrypt hashing with proper salt rounds
- **Refresh Token Management**: Secure token storage with automatic cleanup
- **Foreign Key Constraints**: Proper data integrity and cascade deletion
- **Indexed Queries**: Optimized database queries for performance and security

## Challenge Overview

This codebase contains a partially implemented task management API that suffers from various architectural, performance, and security issues. Your task is to analyze, refactor, and enhance the codebase to create a production-ready, scalable, and secure application.

## Core Problem Areas

The codebase has been intentionally implemented with several critical issues that need to be addressed:

### 1. Performance & Scalability Issues

- N+1 query problems throughout the application
- Inefficient in-memory filtering and pagination that won't scale
- Excessive database roundtrips in batch operations
- Poorly optimized data access patterns

### 2. Architectural Weaknesses

- Inappropriate separation of concerns (e.g., controllers directly using repositories)
- Missing domain abstractions and service boundaries
- Lack of transaction management for multi-step operations
- Tightly coupled components with high interdependency

### 3. Security Vulnerabilities

- Inadequate authentication mechanism with several vulnerabilities
- Improper authorization checks that can be bypassed
- Unprotected sensitive data exposure in error responses
- Insecure rate limiting implementation

### 4. Reliability & Resilience Gaps

- Ineffective error handling strategies
- Missing retry mechanisms for distributed operations
- Lack of graceful degradation capabilities
- In-memory caching that fails in distributed environments

## Implementation Requirements

Your implementation should address the following areas:

### 1. Performance Optimization

- Implement efficient database query strategies with proper joins and eager loading
- Create a performant filtering and pagination system
- Optimize batch operations with bulk database operations
- Add appropriate indexing strategies

### 2. Architectural Improvements

- Implement proper domain separation and service abstractions
- Create a consistent transaction management strategy
- Apply SOLID principles throughout the codebase
- Implement at least one advanced pattern (e.g., CQRS, Event Sourcing)

### 3. Security Enhancements

- Strengthen authentication with refresh token rotation
- Implement proper authorization checks at multiple levels
- Create a secure rate limiting system
- Add data validation and sanitization

### 4. Resilience & Observability

- Implement comprehensive error handling and recovery mechanisms
- Add proper logging with contextual information

## Getting Started (End-to-End)

### Prerequisites

- Node.js (v16+)
- Bun (latest version)
- PostgreSQL
- Redis

### Setup Instructions

#### 1. Clone the repository
```bash
git clone <your-fork-url>
cd scriptassist-nestjs-exercise
```

#### 2. Install dependencies
```bash
bun install
```

#### 3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your PostgreSQL and Redis connection details
```

#### 4. Build the project
```bash
bun run build
```

#### 5. Set up the database
Ensure PostgreSQL is running, then run:
```bash
# Option 1: Standard migration (recommended)
bun run migration:run
# Option 2: Force table creation
bun run migration:custom
```

#### 6. Seed the database
```bash
bun run seed
```

#### 7. Start the development server
```bash
bun run start:dev
```

#### 8. Access the API
- The API will be available at `http://localhost:3000`
- Swagger docs (if enabled): `http://localhost:3000/api`

---