import type { SourceType } from '@/types/video';
import type { IPlayerAdapter } from './PlayerAdapter';
import { HLSAdapter } from './HLSAdapter';
import { NativeAdapter } from './NativeAdapter';

type AdapterFactory = (url: string, options?: Record<string, unknown>) => IPlayerAdapter;

const registry = new Map<SourceType, AdapterFactory>();

registry.set('m3u8', (url, options) => {
  return new HLSAdapter(url, {
    decoderMode: (options?.decoderMode as 'native' | 'wasm') ?? 'native',
    startLevel: (options?.startLevel as number) ?? -1,
    onError: options?.onError as ((error: Error) => void) | undefined,
  });
});

registry.set('mp4', (url) => {
  return new NativeAdapter(url);
});

registry.set('dash', (url) => {
  return new NativeAdapter(url);
});

registry.set('pan', (url) => {
  return new NativeAdapter(url);
});

export function registerAdapter(type: SourceType, factory: AdapterFactory): void {
  registry.set(type, factory);
}

export function createAdapter(type: SourceType, url: string, options?: Record<string, unknown>): IPlayerAdapter {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`No adapter registered for source type: ${type}`);
  }
  return factory(url, options);
}

export function hasAdapter(type: SourceType): boolean {
  return registry.has(type);
}
