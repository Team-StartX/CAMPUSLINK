import { createApp } from './app';
import { config } from './config';
import { deliverMail } from './mail';
import { runReminders } from './reminders';
import { deleteFile } from './storage';
import { Database } from './db';
import { startWorker, workerErrorDetails } from './workers';
const database = new Database();
async function main() {
  const { app, db } = await createApp(database);
  const server = app.listen(config.port, config.host, (error?: Error) => {
    if (error) {
      console.error(`API startup failed: ${error.message}`);
      void db.close().then(() => {
        process.exitCode = 1;
      });
      return;
    }
    console.log(`PlacedIn API ready at http://localhost:${config.port}/api/v1`);
  });
  const stopWorkers = [
    startWorker('Email', () => deliverMail(db)),
    startWorker('Reminder', () => runReminders(db)),
    startWorker('Storage cleanup', async () => {
      for (const job of await db.query<{ id: string; value: string }>(
        'SELECT record_id AS id,value FROM storage_cleanup_jobs',
      )) {
        try {
          await deleteFile(JSON.parse(job.value).key);
          await db.remove('storage-gc', job.id);
        } catch (error) {
          console.error('Storage cleanup will retry', workerErrorDetails(error));
        }
      }
    }),
  ];
  const close = () => {
    for (const stop of stopWorkers) stop();
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
main().catch(async (error) => {
  console.error(error.message);
  process.exitCode = 1;
  await database.close();
});
