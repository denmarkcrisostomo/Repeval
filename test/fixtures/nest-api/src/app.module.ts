import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { HealthController } from './health/health.controller';
import { UsersController } from './users/users.controller';

@Module({ controllers: [AppController, HealthController, UsersController] })
export class AppModule {}
