import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRefreshTokenIpAddressLength1755084900000 implements MigrationInterface {
  name = 'UpdateRefreshTokenIpAddressLength1755084900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the refresh_tokens table exists first
    const tableExists = await queryRunner.hasTable('refresh_tokens');
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      await queryRunner.query(`
        CREATE TABLE "refresh_tokens" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "token" text NOT NULL,
          "expiresAt" TIMESTAMP NOT NULL,
          "isRevoked" boolean NOT NULL DEFAULT false,
          "ipAddress" character varying(64),
          "userAgent" text,
          "replacedByToken" uuid,
          "revokedReason" character varying(100),
          "revokedAt" TIMESTAMP,
          "userId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id")
        )
      `);

      // Create indexes
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")`);
      await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("userId")`);
      await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expiresAt")`);
      await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_is_revoked" ON "refresh_tokens" ("isRevoked")`);

      // Create foreign key
      await queryRunner.query(`
        ALTER TABLE "refresh_tokens" 
        ADD CONSTRAINT "FK_refresh_tokens_user_id" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    } else {
      // Table exists, just update the column length
      await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "ipAddress" TYPE character varying(64)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('refresh_tokens');
    
    if (tableExists) {
      await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "ipAddress" TYPE character varying(45)`);
    }
  }
}
