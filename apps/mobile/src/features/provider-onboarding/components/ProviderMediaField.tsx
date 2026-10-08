import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  PROVIDER_UPLOAD_LIMITS,
  pickProviderFiles,
  uploadProviderFile,
  validatePickedFile,
  type PickedProviderFile,
  type ProviderUploadKind,
  type ProviderUploadPurpose,
} from '@/features/provider-onboarding/utils/providerUploads';

export type UploadItemStatus = 'uploading' | 'uploaded' | 'error';

export type UploadItem = {
  id: string;
  status: UploadItemStatus;
  progress: number;
  previewUri?: string | null;
  filename?: string | null;
  mediaId?: string;
  error?: string;
  file?: PickedProviderFile;
};

type TileProps = {
  item: UploadItem;
  kind: ProviderUploadKind;
  onRetry?: () => void;
  onRemove?: () => void;
  onReplace?: () => void;
};

/** One upload slot: progress, preview, retry and remove/replace. */
export function UploadTile({
  item,
  kind,
  onRetry,
  onRemove,
  onReplace,
}: TileProps) {
  const theme = useTheme();
  const isImage = kind !== 'video' && Boolean(item.previewUri);
  const pct = Math.round(Math.max(0, Math.min(1, item.progress)) * 100);
  return (
    <View
      testID={`upload-tile-${item.status}`}
      style={[
        styles.tile,
        {
          borderColor:
            item.status === 'error'
              ? theme.colors.error
              : theme.colors.borderSoft,
          backgroundColor: theme.colors.surfaceSecondary,
        },
      ]}
    >
      <View
        style={[styles.thumb, { backgroundColor: theme.colors.surfaceMuted }]}
      >
        {isImage ? (
          <Image source={{ uri: item.previewUri! }} style={styles.thumbImage} />
        ) : (
          <AppIcon
            name={kind === 'video' ? 'video' : 'clipboard-list'}
            size={22}
            color={theme.colors.textSecondary}
          />
        )}
      </View>
      <View style={styles.tileBody}>
        <Text
          numberOfLines={1}
          style={[styles.tileName, { color: theme.colors.textPrimary }]}
        >
          {item.filename ||
            (kind === 'video'
              ? 'Video'
              : kind === 'image'
              ? 'Photo'
              : 'Document')}
        </Text>
        {item.status === 'uploading' ? (
          <View style={styles.progressRow}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${pct}%`, backgroundColor: theme.colors.primary },
                ]}
              />
            </View>
            <Text
              style={[styles.tileMeta, { color: theme.colors.textSecondary }]}
            >
              {`Uploading ${pct}%`}
            </Text>
          </View>
        ) : item.status === 'error' ? (
          <Text
            style={[styles.tileMeta, { color: theme.colors.error }]}
            numberOfLines={2}
          >
            {item.error ?? 'Upload failed'}
          </Text>
        ) : (
          <View style={styles.progressRow}>
            <AppIcon
              name="check-circle"
              size={14}
              color={theme.colors.success}
            />
            <Text
              style={[styles.tileMeta, { color: theme.colors.textSecondary }]}
            >
              Uploaded
            </Text>
          </View>
        )}
      </View>
      {item.status === 'uploading' ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <View style={styles.tileActions}>
          {item.status === 'error' && onRetry && item.file ? (
            <PressableScale
              onPress={onRetry}
              accessibilityLabel="Retry upload"
              style={styles.iconBtn}
            >
              <AppIcon
                name="refresh"
                size={18}
                color={theme.colors.primaryMuted}
              />
            </PressableScale>
          ) : null}
          {item.status === 'uploaded' && onReplace ? (
            <PressableScale
              onPress={onReplace}
              accessibilityLabel="Replace file"
              style={styles.iconBtn}
            >
              <AppIcon
                name="edit"
                size={18}
                color={theme.colors.textSecondary}
              />
            </PressableScale>
          ) : null}
          {onRemove ? (
            <PressableScale
              onPress={onRemove}
              accessibilityLabel="Remove file"
              style={styles.iconBtn}
            >
              <AppIcon
                name="trash"
                size={18}
                color={theme.colors.textSecondary}
              />
            </PressableScale>
          ) : null}
        </View>
      )}
    </View>
  );
}

type FieldProps = {
  applicationId: string;
  fieldKey: string;
  label: string;
  kind: ProviderUploadKind;
  purpose: ProviderUploadPurpose;
  multiple?: boolean;
  maxItems?: number;
  /** Existing uploaded items (from the saved application). */
  initialItems: UploadItem[];
  /** Upload transport; injectable for tests and local (no-API) mode. */
  upload?: typeof uploadProviderFile;
  pick?: typeof pickProviderFiles;
  /** `previewUri` is the public URL when available, else the local file. */
  onUploaded: (mediaId: string, previewUri?: string | null) => void;
  onRemoved: (mediaId: string) => Promise<void> | void;
};

let uploadCounter = 0;

/** Real picker + upload field for images, videos and KYC documents. */
export function ProviderMediaField({
  applicationId,
  fieldKey,
  label,
  kind,
  purpose,
  multiple = false,
  maxItems = 10,
  initialItems,
  upload = uploadProviderFile,
  pick = pickProviderFiles,
  onUploaded,
  onRemoved,
}: FieldProps) {
  const theme = useTheme();
  const [items, setItems] = useState<UploadItem[]>(initialItems);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const patch = useCallback((id: string, next: Partial<UploadItem>) => {
    if (!mounted.current) return;
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...next } : item)),
    );
  }, []);

  const runUpload = useCallback(
    async (id: string, file: PickedProviderFile) => {
      patch(id, { status: 'uploading', progress: 0, error: undefined });
      try {
        const result = await upload({
          applicationId,
          fieldKey,
          kind,
          purpose,
          file,
          onProgress: progress => patch(id, { progress }),
        });
        patch(id, { status: 'uploaded', progress: 1, mediaId: result.mediaId });
        // Single fields replace their value; documents are upserted server-side.
        onUploaded(result.mediaId, result.url ?? file.uri);
      } catch (err) {
        patch(id, {
          status: 'error',
          error:
            err instanceof Error ? err.message : 'Upload failed. Please retry.',
        });
      }
    },
    [applicationId, fieldKey, kind, onUploaded, patch, purpose, upload],
  );

  const startPick = useCallback(
    async (source: 'camera' | 'library', replacing?: UploadItem) => {
      let files: PickedProviderFile[];
      try {
        const room =
          multiple && !replacing ? Math.max(1, maxItems - items.length) : 1;
        files = await pick(kind, source, room);
      } catch (err) {
        Alert.alert('Could not open picker', (err as Error).message);
        return;
      }
      for (const file of files) {
        const id =
          replacing && files.length === 1
            ? replacing.id
            : `upload-${(uploadCounter += 1)}`;
        const base: UploadItem = {
          id,
          status: 'uploading',
          progress: 0,
          previewUri: file.uri,
          filename: file.filename,
          file,
        };
        const invalid = validatePickedFile(file, kind);
        setItems(prev => {
          const withoutReplaced =
            replacing && id === replacing.id
              ? prev.filter(i => i.id !== id)
              : prev;
          const nextItem = invalid
            ? { ...base, status: 'error' as const, error: invalid }
            : base;
          return multiple ? [...withoutReplaced, nextItem] : [nextItem];
        });
        if (!invalid) void runUpload(id, file);
      }
    },
    [items.length, kind, maxItems, multiple, pick, runUpload],
  );

  const choose = useCallback(
    (replacing?: UploadItem) => {
      const what = kind === 'video' ? 'video' : 'photo';
      Alert.alert(
        replacing ? `Replace ${label.toLowerCase()}` : label,
        PROVIDER_UPLOAD_LIMITS[kind].label,
        [
          {
            text: kind === 'video' ? 'Record video' : 'Take photo',
            onPress: () => void startPick('camera', replacing),
          },
          {
            text: `Choose ${what} from library`,
            onPress: () => void startPick('library', replacing),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    },
    [kind, label, startPick],
  );

  const remove = useCallback(
    async (item: UploadItem) => {
      if (item.status === 'uploaded' && item.mediaId) {
        try {
          await onRemoved(item.mediaId);
        } catch (err) {
          Alert.alert('Could not remove', (err as Error).message);
          return;
        }
      }
      setItems(prev => prev.filter(i => i.id !== item.id));
    },
    [onRemoved],
  );

  const canAdd = multiple ? items.length < maxItems : items.length === 0;

  return (
    <View style={styles.field}>
      {items.map(item => (
        <UploadTile
          key={item.id}
          item={item}
          kind={kind}
          onRetry={
            item.file ? () => void runUpload(item.id, item.file!) : undefined
          }
          onRemove={() => void remove(item)}
          onReplace={multiple ? undefined : () => choose(item)}
        />
      ))}
      {canAdd ? (
        <PressableScale
          accessibilityLabel={`Upload ${label}`}
          onPress={() => choose()}
          style={[
            styles.addBtn,
            {
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primarySoft,
            },
          ]}
        >
          <AppIcon
            name={
              kind === 'video' ? 'video' : kind === 'image' ? 'image' : 'camera'
            }
            size={18}
            color={theme.colors.primaryMuted}
          />
          <Text style={[styles.addText, { color: theme.colors.primaryMuted }]}>
            {items.length && multiple
              ? 'Add another photo'
              : kind === 'document'
              ? 'Upload document'
              : kind === 'video'
              ? 'Upload video'
              : 'Upload photo'}
          </Text>
        </PressableScale>
      ) : null}
      <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
        {PROVIDER_UPLOAD_LIMITS[kind].label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  tile: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  thumb: {
    alignItems: 'center',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  thumbImage: { height: 52, width: 52 },
  tileBody: { flex: 1, gap: 4 },
  tileName: { fontSize: 14, fontWeight: '700' },
  tileMeta: { fontSize: 12, fontWeight: '600' },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  progressTrack: { borderRadius: 4, height: 5, overflow: 'hidden', width: 90 },
  progressFill: { height: 5 },
  tileActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  addBtn: {
    alignItems: 'center',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  addText: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 11 },
});
