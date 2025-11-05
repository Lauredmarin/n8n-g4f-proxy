import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, map, Observable } from 'rxjs';
import { Readable } from 'stream';

@Injectable()
export class AppService {
  constructor(private readonly http: HttpService) {}

  async getModels(headers: any): Promise<any> {
    const auth: string | null = headers['authorization'];
    const upstream = process.env.LLM_UPSTREAM;
    const providerKey = (process.env.LLM_PROXY_PROVIDER ?? '').toLowerCase();
    const url = `${upstream}/backend-api/v2/models`;

    const resp = await lastValueFrom(
      this.http.get<any>(url, {
        headers: auth ? { Authorization: auth } : {},
      }),
    );

    // Gérer le cas où data peut être imbriqué ou être directement un tableau
    const models = Array.isArray(resp.data) ? resp.data : (resp.data.data || []);
    
    const filteredModels = models.filter((model: any) => {
      return model.providers?.some((provider: string) =>
        provider.toLowerCase() === providerKey
      );
    });

    return {
      "object": "list",
      "data": filteredModels.map((model: any) => ({
        id: model.name,
        object: "model",
        created: 0,
        owned_by: "",
        image: model.image || false,
        provider: true
      }))
    };
  }

  async getProviders(): Promise<string> {
    const upstream = process.env.LLM_UPSTREAM;
    const url = `${upstream}/v1/providers`;

    const response = await lastValueFrom(
      this.http.get<string>(url)
    );

    return response.data;
  }

  postCompletions(body: any, headers: any): Observable<Readable> {
    const auth: string | null = headers['authorization'];
    const upstream = process.env.LLM_UPSTREAM;
    const provider = process.env.LLM_PROXY_PROVIDER;
    const url = `${upstream}/v1/chat/completions`;

    body['provider'] = provider;

    return this.http
      .post(url, body, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: auth } : {}),
        },
        responseType: 'stream'
      })
      .pipe(
        map(resp => resp.data as Readable)
      );
  }
}
