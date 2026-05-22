import { IsString, IsUUID } from 'class-validator';

export class TransferMasterDto {
  @IsString()
  passwordActual: string;

  @IsUUID()
  targetUserId: string;
}

