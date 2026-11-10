import type { AppTheme } from '@/shared/theme';
import type { DeepPartial, Theme } from 'stream-chat-react-native';

/**
 * Keep Stream's independently themed components in sync with Anticlock's
 * resolved app theme. Stream otherwise follows only the device appearance,
 * which can leave a dark conversation inside a light Anticlock screen.
 */
export function createStreamChatTheme(theme: AppTheme): DeepPartial<Theme> {
  return {
    semantics: {
      backgroundCoreApp: theme.colors.background,
      backgroundCoreSurfaceDefault: theme.colors.backgroundElevated,
      backgroundCoreSurfaceSubtle: theme.colors.surfaceMuted,
      chatBgIncoming: theme.colors.surfaceMuted,
      chatBgOutgoing: theme.colors.primary,
      chatTextIncoming: theme.colors.textPrimary,
      chatTextOutgoing: theme.colors.textInverse,
      chatTextSystem: theme.colors.textSecondary,
      chatTextTimestamp: theme.colors.textTertiary,
    },
    messageList: {
      container: { backgroundColor: theme.colors.background },
      listContainer: { backgroundColor: theme.colors.background },
      messageSystem: {
        dateText: { color: theme.colors.textTertiary, flexShrink: 1, textAlign: 'center' },
      },
    },
    messageItemView: {
      // Stream renders system messages using this shared blocked-message style.
      // A column layout prevents the date from being pushed off-screen by a
      // longer connection/welcome message.
      messageBlocked: {
        container: {
          alignSelf: 'center',
          backgroundColor: theme.colors.surfaceMuted,
          flexDirection: 'column',
          maxWidth: '88%',
        },
        text: { color: theme.colors.textSecondary, flexShrink: 1, textAlign: 'center' },
      },
    },
    messageComposer: {
      wrapper: {
        backgroundColor: theme.colors.backgroundElevated,
        borderTopColor: theme.colors.borderSoft,
        borderTopWidth: 1,
        paddingHorizontal: 12,
        paddingTop: 10,
      },
      inputBox: { color: theme.colors.textPrimary },
      inputBoxWrapper: {
        backgroundColor: theme.colors.surfaceMuted,
        borderColor: theme.colors.borderSoft,
        borderRadius: 24,
      },
      focusedInputBoxContainer: { borderColor: theme.colors.primary },
    },
  };
}
