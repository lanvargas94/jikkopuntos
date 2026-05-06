import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { JWT_REFRESH } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
   imports: [
    NotificationsModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_ACCESS_SECRET') ??
          config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(config.get<string>('JWT_ACCESS_EXPIRES_SEC') ?? 900),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: JWT_REFRESH,
      useFactory: (config: ConfigService) => {
        return new JwtService({
          secret: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          signOptions: {
            expiresIn: Number(
              config.get<string>('JWT_REFRESH_EXPIRES_SEC') ?? 604800,
            ),
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
