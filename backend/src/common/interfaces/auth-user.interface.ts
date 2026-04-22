import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  run: string;
  email?: string | null;
  role: Role;
  nombreCompleto: string;
}
