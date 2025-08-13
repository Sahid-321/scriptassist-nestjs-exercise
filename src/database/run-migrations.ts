import { DataSource } from 'typeorm';
import dataSource from './data-source';

async function runMigrations() {
  console.log('Starting migration process...');
  
  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('Database connection initialized successfully.');
    
    // Ensure UUID extension is available
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('UUID extension ensured.');
    
    // Log pending migrations
    const pendingMigrations = await dataSource.showMigrations();
    console.log(`Pending migrations: ${pendingMigrations ? 'Yes' : 'No'}`);
    
    // Run migrations
    console.log('Running migrations...');
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    
    console.log(`Executed ${migrations.length} migrations:`);
    migrations.forEach(migration => console.log(`- ${migration.name}`));

    if (migrations.length === 0) {
      console.log('No migrations were executed. Creating tables directly...');
      
      // Create users table
      console.log('Creating users table...');
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "email" varchar NOT NULL UNIQUE,
          "name" varchar NOT NULL,
          "password" varchar NOT NULL,
          "role" varchar NOT NULL DEFAULT 'user',
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      
      // Create tasks table
      console.log('Creating tasks table...');
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "tasks" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "title" varchar NOT NULL,
          "description" text,
          "status" varchar NOT NULL DEFAULT 'PENDING',
          "priority" varchar NOT NULL DEFAULT 'MEDIUM',
          "due_date" TIMESTAMP NOT NULL,
          "user_id" uuid NOT NULL,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "fk_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      
      // Create refresh_tokens table
      console.log('Creating refresh_tokens table...');
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "refresh_tokens" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "token" text NOT NULL,
          "expiresAt" TIMESTAMP NOT NULL,
          "isRevoked" boolean NOT NULL DEFAULT false,
          "ipAddress" varchar(64),
          "userAgent" text,
          "replacedByToken" uuid,
          "revokedReason" varchar(100),
          "revokedAt" TIMESTAMP,
          "userId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      
      // Create indexes for refresh_tokens
      console.log('Creating refresh_tokens indexes...');
      await dataSource.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("userId")`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expiresAt")`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_is_revoked" ON "refresh_tokens" ("isRevoked")`);
      
      console.log('Tables and indexes created successfully.');
    }
    
    console.log('Migration process completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // Close connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed.');
    }
  }
}

runMigrations()
  .then(() => {
    console.log('Migration process finished.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  }); 