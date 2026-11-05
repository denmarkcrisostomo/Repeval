import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Render('index')
  home() {
    return { title: 'Home' };
  }

  @Render('about')
  @Get('about')
  about() {
    return { title: 'About' };
  }
}
