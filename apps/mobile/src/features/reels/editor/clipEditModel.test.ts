import {
  MAX_CLIP_DURATION_MS,
  buildEditMetadata,
  buildExportOptions,
  clampTrim,
  createEditState,
  formatClock,
  locateInSources,
  maxMusicStartMs,
  usedSegmentCount,
  type ClipSource,
  type MusicTrackOption,
} from './clipEditModel';

const source = (id: string, durationMs: number): ClipSource => ({
  id,
  uri: `file:///tmp/${id}.mp4`,
  durationMs,
  origin: 'camera',
});

const track: MusicTrackOption = {
  id: 'track-1',
  title: 'Morning Run',
  artist: 'House Band',
  durationMs: 120_000,
  source: 'remote',
  playback: 'https://cdn.example.com/a.m4a',
  exportUri: 'https://cdn.example.com/a.m4a',
  license: 'Licensed',
  attribution: null,
};

describe('clipEditModel', () => {
  it('presets long gallery videos to the first 90 seconds', () => {
    const edit = createEditState([source('a', 200_000)]);
    expect(edit.trimStartMs).toBe(0);
    expect(edit.trimEndMs).toBe(MAX_CLIP_DURATION_MS);
  });

  it('clamps trims to the 90 s cap and 1 s minimum', () => {
    expect(clampTrim(200_000, 10_000, 150_000, 'end')).toEqual({
      trimStartMs: 10_000,
      trimEndMs: 100_000,
    });
    expect(clampTrim(200_000, 0, 150_000, 'start')).toEqual({
      trimStartMs: 60_000,
      trimEndMs: 150_000,
    });
    expect(clampTrim(30_000, 5_000, 5_200, 'end')).toEqual({
      trimStartMs: 5_000,
      trimEndMs: 6_000,
    });
    expect(clampTrim(30_000, 5_900, 6_000, 'start')).toEqual({
      trimStartMs: 5_000,
      trimEndMs: 6_000,
    });
  });

  it('locates times across concatenated segments', () => {
    const sources = [source('a', 3_000), source('b', 5_000)];
    expect(locateInSources(sources, 1_000)).toEqual({ index: 0, localMs: 1_000 });
    expect(locateInSources(sources, 4_500)).toEqual({ index: 1, localMs: 1_500 });
    expect(locateInSources(sources, 99_000)).toEqual({ index: 1, localMs: 5_000 });
  });

  it('counts only segments inside the trim window', () => {
    const edit = {
      ...createEditState([source('a', 3_000), source('b', 5_000), source('c', 2_000)]),
      trimStartMs: 3_500,
      trimEndMs: 7_000,
    };
    expect(usedSegmentCount(edit)).toBe(1);
  });

  it('builds metadata matching the API contract', () => {
    const edit = {
      ...createEditState([source('a', 3_000), source('b', 5_000)]),
      music: { track, startMs: 12_345.6, volume: 0.8 },
      originalVolume: 0.25,
    };
    expect(buildEditMetadata(edit)).toEqual({
      music: {
        trackId: 'track-1',
        source: 'remote',
        title: 'Morning Run',
        artist: 'House Band',
        startMs: 12_346,
        volume: 0.8,
      },
      originalVolume: 0.25,
      sourceTrimStartMs: 0,
      sourceTrimEndMs: 8_000,
      segmentCount: 2,
    });
    expect(buildExportOptions(edit)).toMatchObject({
      sources: ['file:///tmp/a.mp4', 'file:///tmp/b.mp4'],
      music: { uri: 'https://cdn.example.com/a.m4a', startMs: 12_346, volume: 0.8 },
      originalVolume: 0.25,
    });
  });

  it('formats helpers', () => {
    expect(maxMusicStartMs(30_000, 45_000)).toBe(0);
    expect(maxMusicStartMs(120_000, 15_000)).toBe(105_000);
    expect(formatClock(65_400)).toBe('1:05');
  });
});
