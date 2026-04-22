import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/common/utils/password.util';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      run: '15960680-5',
      email: null,
      nombreCompleto: 'Mayor Jaime Espinoza Fariña',
      rol: Role.ADMINISTRADOR,
      password: 'Admin123*',
      forcePasswordOnSeed: true,
    },
  ];

  for (const user of users) {
    const passwordHash = await hashPassword(user.password);
    const whereOr = user.email
      ? [{ run: user.run }, { email: user.email }]
      : [{ run: user.run }];

    const existente = await prisma.usuario.findFirst({
      where: {
        OR: whereOr,
      },
      select: { id: true },
    });

    if (existente) {
      await prisma.usuario.update({
        where: { id: existente.id },
        data: {
          run: user.run,
          email: user.email,
          nombreCompleto: user.nombreCompleto,
          rol: user.rol,
          activo: true,
          passwordHash: user.forcePasswordOnSeed ? passwordHash : undefined,
        },
      });
      continue;
    }

    await prisma.usuario.create({
      data: {
        run: user.run,
        email: user.email,
        nombreCompleto: user.nombreCompleto,
        rol: user.rol,
        passwordHash,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    'Seed ejecutado. Usuario único ADMIN: 15.960.680-5 (clave Admin123*)',
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
