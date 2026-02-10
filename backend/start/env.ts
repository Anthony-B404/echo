/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  RESEND_API_KEY: Env.schema.string(),
  RESEND_WEBHOOK_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for frontend URL (used in email links)
  |----------------------------------------------------------
  */
  FRONTEND_URL: Env.schema.string.optional(),
  API_URL: Env.schema.string.optional(),
  MAIL_FROM: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Google OAuth
  |----------------------------------------------------------
  */
  GOOGLE_CLIENT_ID: Env.schema.string(),
  GOOGLE_CLIENT_SECRET: Env.schema.string(),
  GOOGLE_CALLBACK_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Mistral AI
  |----------------------------------------------------------
  */
  MISTRAL_API_KEY: Env.schema.string(),
  INWORLD_API_KEY: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Redis (BullMQ)
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring file storage
  | Note: Add 's3' to the enum when S3 is configured
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['local'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring FFmpeg/FFprobe paths
  | Used in Docker containers where static binaries don't work
  |----------------------------------------------------------
  */
  FFMPEG_PATH: Env.schema.string.optional(),
  FFPROBE_PATH: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring Super Admin
  | Used by the super_admin_seeder to create/promote a user
  |----------------------------------------------------------
  */
  SUPER_ADMIN_EMAIL: Env.schema.string.optional(),
  SUPER_ADMIN_NAME: Env.schema.string.optional(),
})
