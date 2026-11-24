import { NativeModules } from 'react-native';
import { useAssistantStore } from '../store/assistantStore';

type SpeechModule = {
  speak: (text: string) => Promise<void>;
  stop: () => void;
};
const native: SpeechModule | undefined = NativeModules.GenieSpeech;
let generation = 0;
export function stopGenieSpeech() {
  generation++;
  native?.stop();
  useAssistantStore.setState({ speaking: false });
}
export async function speakGenieReply(text: string) {
  stopGenieSpeech();
  const id = generation;
  if (!native || !text.trim()) return;
  useAssistantStore.setState({ speaking: true });
  try {
    await native.speak(text);
  } catch {
    /* Keep the identical reply available in text. */
  } finally {
    if (generation === id) useAssistantStore.setState({ speaking: false });
  }
}
