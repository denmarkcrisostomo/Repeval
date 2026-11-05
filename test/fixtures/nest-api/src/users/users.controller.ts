import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

@Controller({ path: 'users', version: '2' })
export class UsersController {
  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  async create(@Body() body: { name: string }) {
    return body;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { id };
  }
}

@Controller('admin/users')
export class AdminUsersController {
  @Get('count')
  count() {
    return 0;
  }
}
