import {
  EstadoCaso,
  InstitucionDerivacion,
  PrismaClient,
  TipoControl,
  TipoPersona,
} from '@prisma/client';

const prisma = new PrismaClient();

type PersonaDemo = {
  tipoPersona: TipoPersona;
  nombres: string;
  apellidos: string;
  nacionalidad: string;
  edad: number;
  numeroDocumento: string;
  lugarNacimiento?: string;
  profesionOficio?: string;
  estadoCivil?: string;
  domicilio?: string;
  correo?: string;
  telefono?: string;
};

type CasoDemo = {
  codigo: string;
  diasAtras: number;
  hora: number;
  minuto: number;
  tipoControl: TipoControl;
  lugar: string;
  coordenadas: string;
  fechaIngresoDiasAtras?: number;
  documentado: boolean;
  estadoSalud: string;
  observaciones: string;
  vieneAcompanado: boolean;
  existenMenores: boolean;
  institucionDerivacion: InstitucionDerivacion;
  estado: EstadoCaso;
  personas: PersonaDemo[];
};

function fechaConOffset(diasAtras: number, hora: number, minuto: number): Date {
  const fecha = new Date();
  fecha.setSeconds(0, 0);
  fecha.setHours(hora, minuto, 0, 0);
  fecha.setDate(fecha.getDate() - diasAtras);
  return fecha;
}

function fechaNacimientoDesdeEdad(edad: number, seed: number): Date {
  const now = new Date();
  const fecha = new Date(now.getFullYear() - edad, (seed * 2) % 12, ((seed * 3) % 27) + 1);
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

const casosDemo: CasoDemo[] = [
  {
    codigo: 'ACM-DEMO-0001',
    diasAtras: 0,
    hora: 10,
    minuto: 24,
    tipoControl: TipoControl.INGRESO,
    lugar: 'Puesto Fronterizo Desaguadero',
    coordenadas: '-16.5657,-69.0374',
    fechaIngresoDiasAtras: 0,
    documentado: true,
    estadoSalud: 'Sin lesiones aparentes',
    observaciones: 'Ingreso regular verificado en control primario.',
    vieneAcompanado: false,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.PDI,
    estado: EstadoCaso.DERIVADO_PDI,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Juan Carlos',
        apellidos: 'Ramirez Soto',
        nacionalidad: 'Bolivia',
        edad: 29,
        numeroDocumento: 'BOL-0012897',
        lugarNacimiento: 'La Paz',
        profesionOficio: 'Chofer',
        estadoCivil: 'Soltero',
        domicilio: 'Av. Libertad 120, La Paz',
        correo: 'juan.ramirez.demo1@mail.com',
        telefono: '+59171234567',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0002',
    diasAtras: 0,
    hora: 9,
    minuto: 58,
    tipoControl: TipoControl.EGRESO,
    lugar: 'Puesto Fronterizo Tumbes',
    coordenadas: '-3.5707,-80.4515',
    fechaIngresoDiasAtras: 2,
    documentado: true,
    estadoSalud: 'Sin lesiones',
    observaciones: 'Egreso con documentación completa.',
    vieneAcompanado: false,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.NINGUNA,
    estado: EstadoCaso.CERRADO,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'María Fernanda',
        apellidos: 'López Arce',
        nacionalidad: 'Perú',
        edad: 31,
        numeroDocumento: 'PER-8834112',
        lugarNacimiento: 'Piura',
        profesionOficio: 'Comerciante',
        estadoCivil: 'Casada',
        domicilio: 'Jr. Grau 88, Tumbes',
        correo: 'maria.lopez.demo2@mail.com',
        telefono: '+51989111222',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0003',
    diasAtras: 1,
    hora: 9,
    minuto: 31,
    tipoControl: TipoControl.TERRITORIO,
    lugar: 'Defensoría del Pueblo - Zona Norte',
    coordenadas: '-20.2200,-70.1400',
    fechaIngresoDiasAtras: 3,
    documentado: false,
    estadoSalud: 'Presenta lesión superficial en pierna derecha',
    observaciones: 'Se activa protocolo por presencia de menor y falta de documentación.',
    vieneAcompanado: true,
    existenMenores: true,
    institucionDerivacion: InstitucionDerivacion.CARABINEROS,
    estado: EstadoCaso.DERIVADO_CARABINEROS,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'José Luis',
        apellidos: 'Quispe Mita',
        nacionalidad: 'Bolivia',
        edad: 38,
        numeroDocumento: 'BOL-5544211',
        lugarNacimiento: 'Oruro',
        profesionOficio: 'Albañil',
        estadoCivil: 'Conviviente',
        domicilio: 'Sector Alto 44, Oruro',
        correo: 'jose.quispe.demo3@mail.com',
        telefono: '+59175553322',
      },
      {
        tipoPersona: TipoPersona.MENOR,
        nombres: 'Dylan Matías',
        apellidos: 'Quispe',
        nacionalidad: 'Bolivia',
        edad: 10,
        numeroDocumento: 'BOL-M-99331',
        lugarNacimiento: 'Oruro',
        domicilio: 'Sector Alto 44, Oruro',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0004',
    diasAtras: 1,
    hora: 8,
    minuto: 47,
    tipoControl: TipoControl.INGRESO,
    lugar: 'Puesto Fronterizo Santa Rosa',
    coordenadas: '-17.8271,-69.6531',
    fechaIngresoDiasAtras: 1,
    documentado: false,
    estadoSalud: 'Sin lesiones al momento del control',
    observaciones: 'Ingreso irregular, requiere revisión de filiación.',
    vieneAcompanado: true,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.PDI,
    estado: EstadoCaso.PENDIENTE,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Ana Gabriela',
        apellidos: 'Torres Rojas',
        nacionalidad: 'Venezuela',
        edad: 27,
        numeroDocumento: 'VEN-8812339',
        lugarNacimiento: 'Maracay',
        profesionOficio: 'Técnica en alimentos',
        estadoCivil: 'Soltera',
        domicilio: 'Pasaje Central 145, Arica',
        correo: 'ana.torres.demo4@mail.com',
        telefono: '+56977554433',
      },
      {
        tipoPersona: TipoPersona.ACOMPANANTE,
        nombres: 'Luis Alberto',
        apellidos: 'Torres Rojas',
        nacionalidad: 'Venezuela',
        edad: 24,
        numeroDocumento: 'VEN-8812440',
        lugarNacimiento: 'Maracay',
        profesionOficio: 'Jornalero',
        estadoCivil: 'Soltero',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0005',
    diasAtras: 2,
    hora: 8,
    minuto: 12,
    tipoControl: TipoControl.EGRESO,
    lugar: 'Puesto Fronterizo Rumichaca',
    coordenadas: '0.8070,-77.6469',
    fechaIngresoDiasAtras: 30,
    documentado: true,
    estadoSalud: 'Sin lesiones',
    observaciones: 'Salida regular posterior a permanencia temporal.',
    vieneAcompanado: false,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.NINGUNA,
    estado: EstadoCaso.CERRADO,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Miguel Ángel',
        apellidos: 'Díaz Herrera',
        nacionalidad: 'Colombia',
        edad: 42,
        numeroDocumento: 'COL-4488122',
        lugarNacimiento: 'Pasto',
        profesionOficio: 'Conductor',
        estadoCivil: 'Casado',
        domicilio: 'Calle 14 #22-17, Pasto',
        correo: 'miguel.diaz.demo5@mail.com',
        telefono: '+573001112233',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0006',
    diasAtras: 2,
    hora: 11,
    minuto: 15,
    tipoControl: TipoControl.TERRITORIO,
    lugar: 'Terminal de Buses Iquique',
    coordenadas: '-20.2269,-70.1349',
    fechaIngresoDiasAtras: 5,
    documentado: false,
    estadoSalud: 'Refiere lesión en hombro izquierdo',
    observaciones: 'Se deriva a evaluación médica y control secundario.',
    vieneAcompanado: false,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.PDI,
    estado: EstadoCaso.PENDIENTE,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Carlos Andrés',
        apellidos: 'Mamani Choque',
        nacionalidad: 'Bolivia',
        edad: 33,
        numeroDocumento: 'BOL-2299110',
        lugarNacimiento: 'El Alto',
        profesionOficio: 'Mecánico',
        estadoCivil: 'Soltero',
        domicilio: 'Villa Adela 221, El Alto',
        correo: 'carlos.mamani.demo6@mail.com',
        telefono: '+59171119988',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0007',
    diasAtras: 3,
    hora: 14,
    minuto: 5,
    tipoControl: TipoControl.INGRESO,
    lugar: 'Paso Chacalluta',
    coordenadas: '-18.3431,-70.3383',
    fechaIngresoDiasAtras: 3,
    documentado: true,
    estadoSalud: 'Sin lesiones',
    observaciones: 'Ingreso familiar, verificación de vínculo realizada.',
    vieneAcompanado: true,
    existenMenores: true,
    institucionDerivacion: InstitucionDerivacion.CARABINEROS,
    estado: EstadoCaso.DERIVADO_CARABINEROS,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Rosa Elena',
        apellidos: 'Paredes Salinas',
        nacionalidad: 'Perú',
        edad: 36,
        numeroDocumento: 'PER-5422119',
        lugarNacimiento: 'Tacna',
        profesionOficio: 'Vendedora',
        estadoCivil: 'Casada',
        domicilio: 'Calle Lima 452, Tacna',
        correo: 'rosa.paredes.demo7@mail.com',
        telefono: '+51976122334',
      },
      {
        tipoPersona: TipoPersona.MENOR,
        nombres: 'Mateo',
        apellidos: 'Paredes Salinas',
        nacionalidad: 'Perú',
        edad: 13,
        numeroDocumento: 'PER-M-11221',
        lugarNacimiento: 'Tacna',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0008',
    diasAtras: 4,
    hora: 16,
    minuto: 22,
    tipoControl: TipoControl.EGRESO,
    lugar: 'Puesto Fronterizo Colchane',
    coordenadas: '-19.2775,-68.6392',
    fechaIngresoDiasAtras: 60,
    documentado: true,
    estadoSalud: 'Sin lesiones',
    observaciones: 'Egreso regular sin observaciones.',
    vieneAcompanado: false,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.NINGUNA,
    estado: EstadoCaso.CERRADO,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Daniela',
        apellidos: 'Rivas Méndez',
        nacionalidad: 'Colombia',
        edad: 25,
        numeroDocumento: 'COL-7712201',
        lugarNacimiento: 'Cali',
        profesionOficio: 'Estudiante',
        estadoCivil: 'Soltera',
        domicilio: 'Cra 18 #42-15, Cali',
        correo: 'daniela.rivas.demo8@mail.com',
        telefono: '+573101231231',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0009',
    diasAtras: 5,
    hora: 7,
    minuto: 50,
    tipoControl: TipoControl.TERRITORIO,
    lugar: 'Centro de Primera Acogida Arica',
    coordenadas: '-18.4783,-70.3126',
    fechaIngresoDiasAtras: 7,
    documentado: false,
    estadoSalud: 'Sin lesiones, signos de fatiga',
    observaciones: 'Caso en seguimiento por falta de documento.',
    vieneAcompanado: false,
    existenMenores: false,
    institucionDerivacion: InstitucionDerivacion.PDI,
    estado: EstadoCaso.DERIVADO_PDI,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Yeferson',
        apellidos: 'Mora Villalba',
        nacionalidad: 'Venezuela',
        edad: 30,
        numeroDocumento: 'VEN-1000202',
        lugarNacimiento: 'Caracas',
        profesionOficio: 'Obrero',
        estadoCivil: 'Soltero',
        domicilio: 'Sin domicilio fijo',
        correo: 'yeferson.mora.demo9@mail.com',
        telefono: '+56964442211',
      },
    ],
  },
  {
    codigo: 'ACM-DEMO-0010',
    diasAtras: 6,
    hora: 12,
    minuto: 40,
    tipoControl: TipoControl.INGRESO,
    lugar: 'Paso Los Libertadores',
    coordenadas: '-32.8381,-70.0978',
    fechaIngresoDiasAtras: 6,
    documentado: true,
    estadoSalud: 'Sin lesiones',
    observaciones: 'Ingreso por control terrestre con validación biométrica.',
    vieneAcompanado: true,
    existenMenores: true,
    institucionDerivacion: InstitucionDerivacion.CARABINEROS,
    estado: EstadoCaso.PENDIENTE,
    personas: [
      {
        tipoPersona: TipoPersona.PRINCIPAL,
        nombres: 'Paula Andrea',
        apellidos: 'Soto Rojas',
        nacionalidad: 'Perú',
        edad: 34,
        numeroDocumento: 'PER-7611001',
        lugarNacimiento: 'Lima',
        profesionOficio: 'Técnico en enfermería',
        estadoCivil: 'Divorciada',
        domicilio: 'Av. Norte 780, Lima',
        correo: 'paula.soto.demo10@mail.com',
        telefono: '+51999123123',
      },
      {
        tipoPersona: TipoPersona.MENOR,
        nombres: 'Camila',
        apellidos: 'Soto Rojas',
        nacionalidad: 'Perú',
        edad: 8,
        numeroDocumento: 'PER-M-44321',
        lugarNacimiento: 'Lima',
      },
    ],
  },
];

async function main() {
  const admin = await prisma.usuario.findFirst({
    where: {
      OR: [{ run: '15960680-5' }, { run: '15.960.680-5' }],
      activo: true,
      eliminadoAt: null,
    },
    select: { id: true, run: true, nombreCompleto: true },
  });

  if (!admin) {
    throw new Error('No se encontró usuario administrador activo para crear casos demo.');
  }

  for (const [index, caso] of casosDemo.entries()) {
    const fechaHoraProcedimiento = fechaConOffset(caso.diasAtras, caso.hora, caso.minuto);
    const fechaIngreso =
      typeof caso.fechaIngresoDiasAtras === 'number'
        ? fechaConOffset(caso.fechaIngresoDiasAtras, Math.max(caso.hora - 1, 0), caso.minuto)
        : null;

    const personasCreate = caso.personas.map((persona, personaIndex) => ({
      tipoPersona: persona.tipoPersona,
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      nacionalidad: persona.nacionalidad,
      fechaNacimiento: fechaNacimientoDesdeEdad(persona.edad, index + personaIndex + 1),
      edad: persona.edad,
      lugarNacimiento: persona.lugarNacimiento ?? 'No informado',
      numeroDocumento: persona.numeroDocumento,
      profesionOficio: persona.profesionOficio,
      estadoCivil: persona.estadoCivil,
      domicilio: persona.domicilio,
      correo: persona.correo,
      telefono: persona.telefono,
      creadoPorId: admin.id,
    }));

    await prisma.caso.upsert({
      where: { codigo: caso.codigo },
      update: {
        tipoControl: caso.tipoControl,
        fechaHoraProcedimiento,
        lugar: caso.lugar,
        coordenadas: caso.coordenadas,
        fechaIngreso,
        documentado: caso.documentado,
        estadoSalud: caso.estadoSalud,
        observaciones: caso.observaciones,
        vieneAcompanado: caso.vieneAcompanado,
        existenMenores: caso.existenMenores,
        institucionDerivacion: caso.institucionDerivacion,
        estado: caso.estado,
        creadoPorId: admin.id,
        actualizadoPorId: admin.id,
        creadoAt: fechaHoraProcedimiento,
        eliminadoAt: null,
        personas: {
          deleteMany: {},
          create: personasCreate,
        },
      },
      create: {
        codigo: caso.codigo,
        tipoControl: caso.tipoControl,
        fechaHoraProcedimiento,
        lugar: caso.lugar,
        coordenadas: caso.coordenadas,
        fechaIngreso,
        documentado: caso.documentado,
        estadoSalud: caso.estadoSalud,
        observaciones: caso.observaciones,
        vieneAcompanado: caso.vieneAcompanado,
        existenMenores: caso.existenMenores,
        institucionDerivacion: caso.institucionDerivacion,
        estado: caso.estado,
        creadoPorId: admin.id,
        actualizadoPorId: admin.id,
        creadoAt: fechaHoraProcedimiento,
        personas: {
          create: personasCreate,
        },
      },
    });
  }

  const totalCasos = await prisma.caso.count({ where: { eliminadoAt: null } });

  // eslint-disable-next-line no-console
  console.log(
    `Seed demo OK: ${casosDemo.length} casos variados cargados/actualizados. Total casos activos: ${totalCasos}`,
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
