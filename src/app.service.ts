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

    console.log('========================================');
    console.log('[getModels] Fetching models');
    console.log(`[getModels] URL: ${url}`);
    console.log(`[getModels] Provider filter: "${providerKey}" (empty = no filter)`);
    console.log(`[getModels] Has auth: ${!!auth}`);

    try {
      const resp = await lastValueFrom(
        this.http.get<any>(url, {
          headers: auth ? { Authorization: auth } : {},
        }),
      );

      // Gérer le cas où data peut être imbriqué ou être directement un tableau
      const models = Array.isArray(resp.data) ? resp.data : (resp.data.data || []);
      
      console.log(`[getModels] ✓ Total models received: ${models.length}`);
      
      if (!providerKey) {
        console.log(`[getModels] ⚠️  No provider filter - returning all models`);
        return {
          "object": "list",
          "data": models.map((model: any) => ({
            id: model.name,
            object: "model",
            created: 0,
            owned_by: "",
            image: model.image || false,
            provider: true
          }))
        };
      }

      const filteredModels = models.filter((model: any) => {
        const hasProvider = model.providers?.some((provider: string) =>
          provider.toLowerCase() === providerKey
        );
        if (hasProvider) {
          console.log(`[getModels]   ✓ ${model.name} - supports ${providerKey}`);
        }
        return hasProvider;
      });

      console.log(`[getModels] ✓ Filtered models: ${filteredModels.length}/${models.length}`);
      
      if (filteredModels.length === 0) {
        console.log(`[getModels] ⚠️  WARNING: No models support provider "${providerKey}"`);
      }

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
    } catch (error) {
      console.error(`[getModels] ✗ ERROR:`, error.message);
      throw error;
    }
  }

  async getProviders(): Promise<string> {
    const upstream = process.env.LLM_UPSTREAM;
    const url = `${upstream}/v1/providers`;

    console.log('========================================');
    console.log('[getProviders] Fetching providers');
    console.log(`[getProviders] URL: ${url}`);

    try {
      const response = await lastValueFrom(
        this.http.get<string>(url)
      );

      console.log(`[getProviders] ✓ Providers received`);
      return response.data;
    } catch (error) {
      console.error(`[getProviders] ✗ ERROR:`, error.message);
      throw error;
    }
  }

  postCompletions(body: any, headers: any): Observable<Readable> {
    const auth: string | null = headers['authorization'];
    const upstream = process.env.LLM_UPSTREAM;
    const provider = process.env.LLM_PROXY_PROVIDER;
    const url = `${upstream}/v1/chat/completions`;

    // Ajouter le provider seulement s'il est défini
    if (provider) {
      body['provider'] = provider;
    }

    // Déterminer si on veut du streaming ou non
    const isStreaming = body['stream'] !== false;

    console.log('========================================');
    console.log('[postCompletions] Chat completion request');
    console.log(`[postCompletions] URL: ${url}`);
    console.log(`[postCompletions] Model: ${body.model || 'default'}`);
    console.log(`[postCompletions] Provider: ${provider || 'auto (g4f chooses)'}`);
    console.log(`[postCompletions] Streaming: ${isStreaming}`);
    console.log(`[postCompletions] Messages: ${body.messages?.length || 0}`);
    console.log(`[postCompletions] Has auth: ${!!auth}`);
    
    if (body.messages && body.messages.length > 0) {
      console.log(`[postCompletions] First message: "${body.messages[0].content?.substring(0, 50)}..."`);
    }

    return this.http
      .post(url, body, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: auth } : {}),
        },
        responseType: isStreaming ? 'stream' : 'json'
      })
      .pipe(
        map(resp => {
          console.log(`[postCompletions] ✓ Response received (streaming: ${isStreaming})`);
          
          // Si ce n'est pas du streaming, convertir la réponse JSON en stream
          if (!isStreaming && typeof resp.data === 'object') {
            console.log(`[postCompletions] Converting JSON response to stream`);
            console.log(`[postCompletions] Response preview:`, JSON.stringify(resp.data).substring(0, 200));
            const readable = new Readable();
            readable.push(JSON.stringify(resp.data));
            readable.push(null);
            return readable;
          }
          
          console.log(`[postCompletions] Piping stream response`);
          return resp.data as Readable;
        })
      );
  }
}
