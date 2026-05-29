// @flow
import * as React from 'react';
import { GDevelopGenerationApi } from '../Utils/GDevelopServices/ApiConfigs';
import PreferencesContext from '../MainFrame/Preferences/PreferencesContext';
import AuthenticatedUserContext from '../Profile/AuthenticatedUserContext';
import { type Profile } from '../Utils/GDevelopServices/Authentication';
import { type AiConfigurationPresetWithAvailability } from './AiConfiguration';

export type AiGenerationServiceAuthenticationType = 'gdevelop' | 'custom';

export type AiGenerationServicePreset = {|
  id: string,
  mode: 'chat' | 'agent' | 'orchestrator',
  name: string,
  disabled?: boolean,
  isDefault?: boolean,
|};

export type AiGenerationServiceConfig = {|
  id: string,
  name: string,
  baseUrl: string,
  authenticationType: AiGenerationServiceAuthenticationType,
  authorizationHeader: string,
  userId: string,
  aiConfigurationPresets: Array<AiGenerationServicePreset>,
|};

export type AiGenerationServicesPreferences = {|
  aiGenerationServices: Array<AiGenerationServiceConfig>,
  selectedAiGenerationServiceId: string,
|};

export const gdevelopCloudAiServiceId = 'gdevelop-cloud';
const defaultCustomUserId = 'local-user';
const localCodexAiServiceBaseUrl = 'http://localhost:3210/generation';

export const getGDevelopCloudAiServiceConfig = (): AiGenerationServiceConfig => ({
  id: gdevelopCloudAiServiceId,
  name: 'GDevelop Cloud',
  baseUrl: GDevelopGenerationApi.baseUrl,
  authenticationType: 'gdevelop',
  authorizationHeader: '',
  userId: '',
  aiConfigurationPresets: [],
});

const trimTrailingSlashes = (value: string): string =>
  value.replace(/\/+$/, '');

export const normalizeAiServiceConfig = (
  service: AiGenerationServiceConfig
): AiGenerationServiceConfig => {
  if (service.id === gdevelopCloudAiServiceId) {
    return getGDevelopCloudAiServiceConfig();
  }

  return {
    ...service,
    name: (service.name || '').trim() || 'Custom AI service',
    baseUrl: trimTrailingSlashes(
      (service.baseUrl || '').trim() || GDevelopGenerationApi.baseUrl
    ),
    authenticationType: service.authenticationType || 'custom',
    authorizationHeader: (service.authorizationHeader || '').trim(),
    userId: (service.userId || '').trim(),
    aiConfigurationPresets: service.aiConfigurationPresets || [],
  };
};

export const createCustomAiServiceConfig = ({
  id,
}: {|
  id: string,
|}): AiGenerationServiceConfig => ({
  id,
  name: 'Local Codex',
  baseUrl: localCodexAiServiceBaseUrl,
  authenticationType: 'custom',
  authorizationHeader: '',
  userId: defaultCustomUserId,
  aiConfigurationPresets: [],
});

const getAiConfigurationPresetMode = (
  mode: string
): ?('chat' | 'agent' | 'orchestrator') => {
  if (mode === 'chat' || mode === 'agent' || mode === 'orchestrator') {
    return mode;
  }

  return null;
};

export const parseAiGenerationServicePresets = (
  presetText: string
): Array<AiGenerationServicePreset> => {
  const presets: Array<AiGenerationServicePreset> = [];
  presetText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .forEach(line => {
      const [id, mode, name, defaultMarker] = line
        .split('|')
        .map(part => part.trim());
      const presetMode = getAiConfigurationPresetMode(mode);

      if (!id || !presetMode || !name) {
        return;
      }

      presets.push({
        id,
        mode: presetMode,
        name,
        isDefault:
          !!defaultMarker &&
          ['default', 'true', 'yes', '1'].includes(defaultMarker.toLowerCase()),
      });
    });

  return presets;
};

export const serializeAiGenerationServicePresets = (
  presets: Array<AiGenerationServicePreset>
): string =>
  presets
    .map(
      preset =>
        `${preset.id}|${preset.mode}|${preset.name}${
          preset.isDefault ? '|default' : ''
        }`
    )
    .join('\n');

export const getAiServiceConfigs = ({
  aiGenerationServices,
}: {|
  aiGenerationServices: Array<AiGenerationServiceConfig>,
|}): Array<AiGenerationServiceConfig> => {
  const gdevelopCloudService = getGDevelopCloudAiServiceConfig();
  const customServices = aiGenerationServices
    .filter(service => service.id !== gdevelopCloudAiServiceId)
    .map(normalizeAiServiceConfig);

  return [gdevelopCloudService, ...customServices];
};

export const getSelectedAiServiceConfig = (
  preferences: AiGenerationServicesPreferences
): AiGenerationServiceConfig => {
  const services = getAiServiceConfigs({
    aiGenerationServices: preferences.aiGenerationServices,
  });
  const selectedService = services.find(
    service => service.id === preferences.selectedAiGenerationServiceId
  );

  return selectedService || services[0];
};

export const isGDevelopCloudAiService = (
  service: AiGenerationServiceConfig
): boolean => service.id === gdevelopCloudAiServiceId;

export const getAiServiceUserId = (
  service: AiGenerationServiceConfig,
  profile: ?Profile
): ?string => {
  if (isGDevelopCloudAiService(service)) {
    return profile ? profile.id : null;
  }

  return service.userId || defaultCustomUserId;
};

export const getAiServiceAuthorizationHeader = async ({
  service,
  getGDevelopAuthorizationHeader,
}: {|
  service: AiGenerationServiceConfig,
  getGDevelopAuthorizationHeader: () => Promise<string>,
|}): Promise<?string> => {
  if (isGDevelopCloudAiService(service)) {
    return getGDevelopAuthorizationHeader();
  }

  return service.authorizationHeader || null;
};

export const getAiConfigurationPresetsForService = (
  service: AiGenerationServiceConfig
): Array<AiConfigurationPresetWithAvailability> =>
  service.aiConfigurationPresets.map(preset => ({
    id: preset.id,
    mode: preset.mode,
    nameByLocale: { en: preset.name },
    disabled: !!preset.disabled,
    isDefault: !!preset.isDefault,
    enableWith: null,
  }));

export type AiGenerationService = {|
  service: AiGenerationServiceConfig,
  isGDevelopCloudService: boolean,
  userId: ?string,
  getAuthorizationHeader: () => Promise<?string>,
|};

export const useAiGenerationService = (): AiGenerationService => {
  const { values } = React.useContext(PreferencesContext);
  const { profile, getAuthorizationHeader } = React.useContext(
    AuthenticatedUserContext
  );

  const service = React.useMemo(
    () =>
      getSelectedAiServiceConfig({
        aiGenerationServices: values.aiGenerationServices,
        selectedAiGenerationServiceId: values.selectedAiGenerationServiceId,
      }),
    [values.aiGenerationServices, values.selectedAiGenerationServiceId]
  );
  const isGDevelopCloudService = isGDevelopCloudAiService(service);
  const userId = getAiServiceUserId(service, profile);

  const getSelectedAuthorizationHeader = React.useCallback(
    () =>
      getAiServiceAuthorizationHeader({
        service,
        getGDevelopAuthorizationHeader: getAuthorizationHeader,
      }),
    [service, getAuthorizationHeader]
  );

  return {
    service,
    isGDevelopCloudService,
    userId,
    getAuthorizationHeader: getSelectedAuthorizationHeader,
  };
};
