import { Jaf, PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/common/utils/password.util';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      run: '15960680-5',
      email: null,
      nombreCompleto: 'Mayor Jaime Espinoza Fariña',
      rol: Role.ADMINISTRADOR,
      esMaster: true,
      jaf: Jaf.TARAPACA,
      password: 'Admin123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000001-1',
      email: null,
      nombreCompleto: 'Administrador Operativo JAF Tarapacá',
      rol: Role.ADMINISTRADOR,
      esMaster: false,
      jaf: Jaf.TARAPACA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000002-K',
      email: null,
      nombreCompleto: 'Administrador Operativo JAF Antofagasta',
      rol: Role.ADMINISTRADOR,
      esMaster: false,
      jaf: Jaf.ANTOFAGASTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000003-8',
      email: null,
      nombreCompleto: 'Administrador Operativo JAF Arica y Parinacota',
      rol: Role.ADMINISTRADOR,
      esMaster: false,
      jaf: Jaf.ARICA_PARINACOTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000004-6',
      email: null,
      nombreCompleto: 'Operador JAF Tarapacá',
      rol: Role.OPERADOR,
      esMaster: false,
      jaf: Jaf.TARAPACA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000005-4',
      email: null,
      nombreCompleto: 'Operador JAF Antofagasta',
      rol: Role.OPERADOR,
      esMaster: false,
      jaf: Jaf.ANTOFAGASTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000006-2',
      email: null,
      nombreCompleto: 'Operador JAF Arica y Parinacota',
      rol: Role.OPERADOR,
      esMaster: false,
      jaf: Jaf.ARICA_PARINACOTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000007-0',
      email: null,
      nombreCompleto: 'Auditor Demo',
      rol: Role.AUDITOR,
      esMaster: false,
      jaf: null,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000014-3',
      email: null,
      nombreCompleto: 'Consulta JAF Tarapacá',
      rol: Role.CONSULTA,
      esMaster: false,
      jaf: Jaf.TARAPACA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000015-1',
      email: null,
      nombreCompleto: 'Consulta JAF Antofagasta',
      rol: Role.CONSULTA,
      esMaster: false,
      jaf: Jaf.ANTOFAGASTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000016-K',
      email: null,
      nombreCompleto: 'Consulta JAF Arica y Parinacota',
      rol: Role.CONSULTA,
      esMaster: false,
      jaf: Jaf.ARICA_PARINACOTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000008-9',
      email: null,
      nombreCompleto: 'CB1 Cesar Vasquez - JAF Tarapacá',
      rol: Role.CARABINEROS,
      esMaster: false,
      jaf: Jaf.TARAPACA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000009-7',
      email: null,
      nombreCompleto: 'CB1 Carabineros Demo - JAF Antofagasta',
      rol: Role.CARABINEROS,
      esMaster: false,
      jaf: Jaf.ANTOFAGASTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000010-0',
      email: null,
      nombreCompleto: 'CB1 Carabineros Demo - JAF Arica y Parinacota',
      rol: Role.CARABINEROS,
      esMaster: false,
      jaf: Jaf.ARICA_PARINACOTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000011-9',
      email: null,
      nombreCompleto: 'Subinspector PDI Demo - JAF Tarapacá',
      rol: Role.PDI,
      esMaster: false,
      jaf: Jaf.TARAPACA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000012-7',
      email: null,
      nombreCompleto: 'Subinspector PDI Demo - JAF Antofagasta',
      rol: Role.PDI,
      esMaster: false,
      jaf: Jaf.ANTOFAGASTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
    {
      run: '21000013-5',
      email: null,
      nombreCompleto: 'Subinspector PDI Demo - JAF Arica y Parinacota',
      rol: Role.PDI,
      esMaster: false,
      jaf: Jaf.ARICA_PARINACOTA,
      password: 'Demo123*',
      forcePasswordOnSeed: true,
    },
  ];

  await prisma.usuario.updateMany({
    where: {
      esMaster: true,
      run: {
        not: '15960680-5',
      },
    },
    data: {
      esMaster: false,
    },
  });

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
          esMaster: user.esMaster,
          jaf: user.jaf,
          activo: true,
          eliminadoAt: null,
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
        esMaster: user.esMaster,
        jaf: user.jaf,
        passwordHash,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    'Seed ejecutado. Admin Master: 15.960.680-5 (Admin123*) | usuarios demo: 21.000.001-1 a 21.000.016-K (Demo123*)',
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
