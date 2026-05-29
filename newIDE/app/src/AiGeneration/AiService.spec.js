// @flow
import {
  getAiConfigurationPresetsForService,
  getAiServiceAuthorizationHeader,
  getAiServiceUserId,
  getSelectedAiServiceConfig,
  isGDevelopCloudAiService,
  parseAiGenerationServicePresets,
  serializeAiGenerationServicePresets,
} from './AiService';
import { GDevelopGenerationApi } from '../Utils/GDevelopServices/ApiConfigs';

describe('AiService', () => {
  it('uses the built-in GDevelop Cloud service by default', async () => {
    const service = getSelectedAiServiceConfig({
      aiGenerationServices: [],
      selectedAiGenerationServiceId: 'missing',
    });

    expect(service.id).toBe('gdevelop-cloud');
    expect(service.name).toBe('GDevelop Cloud');
    expect(service.baseUrl).toBe(GDevelopGenerationApi.baseUrl);
    expect(isGDevelopCloudAiService(service)).toBe(true);
    expect(getAiServiceUserId(service, ({ id: 'gdevelop-user' }: any))).toBe(
      'gdevelop-user'
    );
    await expect(
      getAiServiceAuthorizationHeader({
        service,
        getGDevelopAuthorizationHeader: async () => 'Bearer firebase-token',
      })
    ).resolves.toBe('Bearer firebase-token');
  });

  it('normalizes a custom service and uses its local user and authorization', async () => {
    const service = getSelectedAiServiceConfig({
      selectedAiGenerationServiceId: 'local-codex',
      aiGenerationServices: [
        {
          id: 'local-codex',
          name: 'Local Codex',
          baseUrl: 'http://localhost:3210/generation/',
          authenticationType: 'custom',
          authorizationHeader: 'Bearer codex-oauth-token',
          userId: 'codex-user',
          aiConfigurationPresets: [],
        },
      ],
    });

    expect(service.baseUrl).toBe('http://localhost:3210/generation');
    expect(isGDevelopCloudAiService(service)).toBe(false);
    expect(getAiServiceUserId(service, null)).toBe('codex-user');
    await expect(
      getAiServiceAuthorizationHeader({
        service,
        getGDevelopAuthorizationHeader: async () => {
          throw new Error('GDevelop auth should not be used.');
        },
      })
    ).resolves.toBe('Bearer codex-oauth-token');
  });

  it('returns no presets for a custom service without configured presets', () => {
    const service = getSelectedAiServiceConfig({
      selectedAiGenerationServiceId: 'local-codex',
      aiGenerationServices: [
        {
          id: 'local-codex',
          name: 'Local Codex',
          baseUrl: 'http://localhost:3210/generation',
          authenticationType: 'custom',
          authorizationHeader: '',
          userId: '',
          aiConfigurationPresets: [],
        },
      ],
    });

    expect(getAiConfigurationPresetsForService(service)).toEqual([]);
  });

  it('parses optional custom presets from preferences text', () => {
    const presets = parseAiGenerationServicePresets(
      [
        'default|chat|Default|default',
        'codex-fast|agent|Codex fast',
        'bad-line',
      ].join('\n')
    );

    expect(presets).toEqual([
      {
        id: 'default',
        mode: 'chat',
        name: 'Default',
        isDefault: true,
      },
      {
        id: 'codex-fast',
        mode: 'agent',
        name: 'Codex fast',
        isDefault: false,
      },
    ]);
    expect(serializeAiGenerationServicePresets(presets)).toBe(
      ['default|chat|Default|default', 'codex-fast|agent|Codex fast'].join('\n')
    );
  });
});
