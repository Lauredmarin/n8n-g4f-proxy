import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
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
    console.log(`[getModels] Provider filter: "${providerKey}"`);

    try {
      const resp = await lastValueFrom(
        this.http.get<any>(url, {
          headers: auth ? { Authorization: auth } : {},
        }),
      );

      const models = Array.isArray(resp.data) ? resp.data : (resp.data.data || []);
      console.log(`[getModels] Total models: ${models.length}`);

      if (!providerKey) {
        console.log('[getModels] No provider filter - returning all models');
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
        return model.providers?.some((provider: string) =>
          provider.toLowerCase() === providerKey
        );
      });

      console.log(`[getModels] Filtered models: ${filteredModels.length}`);

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
      console.error('[getModels] Error:', error.message);
      throw error;
    }
  }

  async getProviders(): Promise<string> {
    const upstream = process.env.LLM_UPSTREAM;
    const url = `${upstream}/v1/providers`;

    console.log('========================================');
    console.log('[getProviders] Fetching from:', url);

    try {
      const response = await lastValueFrom(
        this.http.get<string>(url)
      );
      return response.data;
    } catch (error) {
      console.error('[getProviders] Error:', error.message);
      throw error;
    }
  }

  async postCompletions(body: any, headers: any): Promise<any> {
    const auth: string | null = headers['authorization'];
    const upstream = process.env.LLM_UPSTREAM;
    const provider = process.env.LLM_PROXY_PROVIDER;
    const url = `${upstream}/v1/chat/completions`;

    if (provider) {
      body['provider'] = provider;
    }

    const isStreaming = body['stream'] === true;

    console.log('========================================');
    console.log('[postCompletions] Request');
    console.log(`[postCompletions] URL: ${url}`);
    console.log(`[postCompletions] Model: ${body.model || 'default'}`);
    console.log(`[postCompletions] Provider: ${provider || 'auto'}`);
    console.log(`[postCompletions] Streaming: ${isStreaming}`);
    console.log(`[postCompletions] Messages: ${body.messages?.length || 0}`);

    try {
      const response = await lastValueFrom(
        this.http.post(url, body, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: auth } : {}),
          },
          responseType: isStreaming ? 'stream' : 'json',
          timeout: 60000, // 60 secondes
        })
      );

      console.log('[postCompletions] ✓ Response received');

      // Si streaming, retourner le stream directement
      if (isStreaming) {
        console.log('[postCompletions] Returning stream');
        return response.data as Readable;
      }

      // Sinon retourner le JSON
      console.log('[postCompletions] Returning JSON');
      return response.data;

    } catch (error) {
      console.error('[postCompletions] ✗ Error:', error.message);
      if (error.response) {
        console.error('[postCompletions] Response status:', error.response.status);
        console.error('[postCompletions] Response data:', error.response.data);
      }
      throw error;
    }
  }
}
