import { Jaf, Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  run: string;
  role: Role;
  nombreCompleto: string;
  esMaster: boolean;
  jaf: Jaf | null;
  sesionId?: string;
}
