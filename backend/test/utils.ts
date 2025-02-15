import { bootstrap } from '../src/app.js';
import { initORM } from '../src/db.js';
import config from '../src/mikro-orm.config.js';
import { TestSeeder } from '../src/seeders/TestSeeder';

export async function initTestApp(port: number) {
  // this will create all the ORM services and cache them
  const { orm } = await initORM({
    // first, include the main config
    ...config,
    // no need for debug information, it would only pollute the logs
    debug: true,
    dbName: 'cc-katalog-test',
    // this will ensure the ORM discovers TS entities, with ts-node, ts-jest and vitest
    // it will be inferred automatically, but we are using vitest here
    // preferTs: true,
  });

  await orm.schema.refreshDatabase(); // Drops & re-creates schema
  await orm.seeder.seed(TestSeeder);

  const { app } = await bootstrap(port, false);

  return app;
}
