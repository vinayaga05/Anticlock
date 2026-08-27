import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/shared/store/themeStore';
import { darkTheme, lightTheme, AppTheme } from '@/shared/theme';

export function useTheme(): AppTheme {
  const systemScheme = useColorScheme();
  const mode = useThemeStore(state => state.mode);

  const resolvedMode =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  return resolvedMode === 'dark' ? darkTheme : lightTheme;
}
