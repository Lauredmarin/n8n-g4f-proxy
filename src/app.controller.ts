import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/v1/models')
  getModels(@Req() req: Request) {
    return this.appService.getModels(req.headers);
  }

  @Get('/v1/providers')
  getProviders(): Promise<string> {
    return this.appService.getProviders();
  }

  @Post('/v1/chat/completions')
  async postCompletions(@Req() req: Request, @Res() res: Response) {
    try {
      // Attendre la réponse de l'Observable
      const result = await this.appService.postCompletions(req.body, req.headers);
      
      // Si c'est un stream, le piper
      if (result instanceof require('stream').Readable) {
        result.pipe(res);
      } else {
        // Sinon envoyer directement
        res.json(result);
      }
    } catch (error) {
      console.error('[Controller] Error in postCompletions:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
