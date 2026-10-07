import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Codegen spec. Complex options travel as JSON strings to keep the native
 * surface small; `src/index.ts` provides the typed API.
 */
export interface Spec extends TurboModule {
  getInfo(uri: string): Promise<Object>;
  generateThumbnails(
    uris: Array<string>,
    count: number,
    widthPx: number,
  ): Promise<Object>;
  exportClip(optionsJson: string): Promise<Object>;
  cancelExport(): void;
  getExportProgress(): number;
}

export default TurboModuleRegistry.get<Spec>('ClipEditor');
