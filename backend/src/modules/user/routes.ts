import { FastifyInstance } from 'fastify'
import { initORM } from '../../db.js'
import { wrap } from '@mikro-orm/core'
import { getUserFromToken } from '../common/utils.js'
import { User } from './user.entity.js'
import { errorSchema } from '../common/errors.js'
import { exhibitBaseSchema } from '../exhibit/routes.js'

export const userBaseSchema = () => ({
  type: 'object',
  properties: {
    fullName: { type: 'string', examples: ['Daffy Duck'] },
    bio: {
      type: 'string',
      examples: ['I was born with a plastic spoon in my mouth.'],
    },
    contacts: {
      type: 'object',
      properties: {
        email: { type: 'string', examples: ['daffy@duck.com'] },
        phone: { type: 'string', examples: ['0123 567 7890'] },
        website: { type: 'string', examples: ['https://daffy-duck.com/'] },
        mastodon: { type: 'string', examples: ['@daffyduck@mastodon.social'] },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
})

// An existing user reported without their tables or exhibitions
export const userBaseResponseSchema = () => ({
  ...userBaseSchema(),
  required: ['id', 'username', 'isAdministrator'],
  properties: {
    id: { type: 'integer', examples: [23] },
    username: { type: 'string', examples: ['donald'] },
    ...userBaseSchema().properties,
    isAdministrator: { type: 'boolean' },
  },
})

export const userResponseSchema = () => ({
  ...userBaseResponseSchema(),
  required: ['id', 'username', 'isAdministrator'],
  properties: {
    ...userBaseResponseSchema().properties,
    tables: { type: 'array', items: { type: 'number' } },
    exhibits: { type: 'array', items: exhibitBaseSchema() },
  },
})

export async function registerUserRoutes(app: FastifyInstance) {
  const db = await initORM()

  const makeUserResponse = async (user: User) => {
    await db.em.populate(user, ['exhibits', 'tables'])
    return {
      ...user,
      tables: user.tables.map(({ id }) => id),
      exhibits: user.exhibits.map(({ table, ...exhibit }) => ({
        ...exhibit,
        table: table?.id,
      })),
    }
  }

  app.post(
    '/login',
    {
      schema: {
        description: 'Log in',
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', examples: ['donald'] },
            password: { type: 'string', examples: ['geheim'] },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            description: 'The user was logged in',
            ...userResponseSchema(),
            properties: {
              ...userResponseSchema().properties,
              token: {
                type: 'string',
                examples: [
                  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzA3ODQ5NjAwfQ.9mYrO5fRBY3eCQ7fFbUs89QXH8-Q5uD7eZFYd58XGWA',
                ],
              },
            },
          },
          400: {
            description: 'Invalid input parameter(s).',
            ...errorSchema,
          },
          401: {
            description: 'Invalid username or password',
            ...errorSchema,
          },
        },
      },
    },
    async (request) => {
      const { username, password } = request.body as {
        username: string
        password: string
      }
      const user = await db.user.login(username, password)
      user.token = app.jwt.sign({ id: user.id })
      request.session.user = { username }
      return makeUserResponse(user)
    },
  )

  app.get(
    '/profile',
    {
      schema: {
        description: 'Retrieve the profile of the currently logged in user',
        response: {
          200: {
            description:
              'The profile of the currently logged in user is returned',
            ...userResponseSchema(),
          },
          401: {
            description: 'Not logged in.',
            ...errorSchema,
          },
        },
      },
    },
    async (request) => {
      const user = getUserFromToken(request)
      return makeUserResponse(user)
    },
  )

  app.get(
    '/',
    {
      schema: {
        description: 'Retrieve the full user list',
        response: {
          200: {
            description: 'The user list is returned',
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: userResponseSchema(),
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async () => {
      const users = await db.user.findAll({ populate: ['tables', 'exhibits'] })
      return {
        items: await Promise.all(users.map(makeUserResponse)),
        total: users.length,
      }
    },
  )

  app.get(
    '/:id',
    {
      schema: {
        description: 'Retrieve the profile of the user identified by ID',
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Username or ID of the user to look up',
            },
          },
          required: ['id'],
        },
        response: {
          200: {
            description: 'The profile of the user is returned',
            ...userResponseSchema(),
          },
          404: {
            description: 'No user was found matching the given ID',
            ...errorSchema,
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string }
      const user = await db.user.lookup(id)
      return makeUserResponse(user)
    },
  )

  app.patch(
    '/profile',
    {
      schema: {
        description: 'Update user account',
        body: {
          ...userBaseSchema(),
          properties: {
            ...userBaseSchema().properties,
            password: { type: 'string', examples: ['geheim'] },
          },
        },
        response: {
          200: {
            description: 'The user account was updated',
            ...userResponseSchema(),
          },
          400: {
            description: 'The user account could not be updated.',
            ...errorSchema,
          },
        },
      },
    },
    async (request) => {
      const updates = request.body as User
      const user = getUserFromToken(request)
      wrap(user).assign(updates)
      await db.em.flush()
      return makeUserResponse(user)
    },
  )
}
