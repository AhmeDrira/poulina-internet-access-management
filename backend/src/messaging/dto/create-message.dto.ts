import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Message professionnel adressé au correspondant du traitement',
    minLength: 2,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(2, { message: 'Le message est trop court.' })
  @MaxLength(2000, { message: 'Le message ne peut pas dépasser 2000 caractères.' })
  body: string;
}
