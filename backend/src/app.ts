import { NotFoundError, RequestContext } from '@mikro-orm/core';
import { fastify } from 'fastify';
import fastifyJWT from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { initORM } from './db.js';
import { registerArticleRoutes } from './modules/article/routes.js';
import { registerUserRoutes } from './modules/user/routes.js';
import { AuthError } from './modules/common/utils.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function bootstrap(port: number | undefined, migrate: boolean | undefined) {
  const db = await initORM();

  if (migrate) {
    // sync the schema
    await db.orm.migrator.up();
  }

  const app = fastify();

  app.register(fastifyStatic, {
    root: path.join(__dirname, '../../frontend/dist')
  })

  // register JWT plugin
  app.register(fastifyJWT, {
    secret: process.env.JWT_SECRET ?? '12345678', // fallback for testing
  });

  // register request context hook
  app.addHook('onRequest', (request, reply, done) => {
    RequestContext.create(db.em, done);
  });

  // register auth hook after the ORM one to use the context
  app.addHook('onRequest', async (request) => {
    try {
      const ret = await request.jwtVerify<{ id: number }>();
      request.user = await db.user.findOneOrFail(ret.id);
    } catch (e) {
      app.log.error(e);
      // ignore token errors, we validate the request.user exists only where needed
    }
  });

  // register global error handler to process 404 errors from `findOneOrFail` calls
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      return reply.status(401).send({ error: error.message });
    }

    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: error.message });
    }

    app.log.error(error);
    console.log(error);
    reply.status(500).send({ error: error.message });
  });

  // shut down the connection when closing the app
  app.addHook('onClose', async () => {
    await db.orm.close();
  });

  // register routes here
  app.register(registerArticleRoutes, { prefix: 'article' });
  app.register(registerUserRoutes, { prefix: 'user' });

  const url = await app.listen({ port });

  return { app, url, db };
}
