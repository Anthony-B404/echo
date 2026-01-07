/*
|--------------------------------------------------------------------------
| Worker entrypoint
|--------------------------------------------------------------------------
|
| The "worker.ts" file is the entrypoint for starting the BullMQ workers.
| This file boots the AdonisJS application and starts the queue workers.
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .startApp(['providers/app_provider'])
  .then(async () => {
    // Import and start workers after app is booted
    await import('#start/worker')
    console.log('[Worker] All workers started successfully')
  })
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
