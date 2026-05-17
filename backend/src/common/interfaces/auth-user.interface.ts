import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  run: string;
  role: Role;
  nombreCompleto: string;
}
