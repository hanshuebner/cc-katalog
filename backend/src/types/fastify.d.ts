// src/types/fastify.d.ts
import { OAuth2Namespace } from '@fastify/oauth2';

declare module 'fastify' {
  interface FastifyInstance {
    forumOAuth2: OAuth2Namespace;
  }
}
