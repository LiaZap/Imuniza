import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@imuniza/db';
import { AUTH_COOKIE, cookieOptions, signSession, verifyPassword } from '../services/auth.js';
import { authGuard } from '../plugins/authGuard.js';

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const token = await signSession({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    reply.setCookie(AUTH_COOKIE, token, cookieOptions());

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: authGuard }, async (req) => {
    const session = req.session!;
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });
    return { user };
  });
}
