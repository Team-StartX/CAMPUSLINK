import { createApp } from './app';
import { config } from './config';
import { deliverMail } from './mail';
import { runReminders } from './reminders';
import { deleteFile } from './storage';
async function main() {
  const { app, db } = await createApp();
  const server = app.listen(config.port, config.host, (error?: Error) => {
    if (error) {
      console.error(`API startup failed: ${error.message}`);
      void db.close().then(() => {
        process.exitCode = 1;
      });
      return;
    }
    console.log(`CampusLink API ready at http://localhost:${config.port}/api/v1`);
  });
  const timer = setInterval(() => {
    void deliverMail(db).catch(() => console.error('Email worker failed'));
    void runReminders(db).catch(() => console.error('Reminder worker failed'));
    void (async () => {
      for (const job of await db.query<{ id: string; value: string }>(
        "SELECT id,value FROM records WHERE kind='storage-gc'",
      )) {
        try {
          await deleteFile(JSON.parse(job.value).key);
          await db.remove('storage-gc', job.id);
        } catch {
          console.error('Storage cleanup will retry');
        }
      }
    })().catch(() => console.error('Storage cleanup worker failed'));
  }, 30000);
  timer.unref();
  const close = () => {
    clearInterval(timer);
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
