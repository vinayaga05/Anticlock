import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { usePublisherSelection } from './usePublisherSelection';

const personal = { type: 'user' as const, id: 'u1', name: 'Arjun', avatarUrl: null, profileType: 'personal' as const };
const lotus = { type: 'provider' as const, id: 'b1', name: 'Lotus Yoga', avatarUrl: null, profileType: 'business' as const };
const fade = { type: 'provider' as const, id: 'b2', name: 'Urban Fade', avatarUrl: null, profileType: 'business' as const };

let mockIdentities: unknown[] | undefined = [personal, lotus, fade];
let mockGlobalActiveId: string | null = 'b1';

jest.mock('@/shared/api/publishingHooks', () => ({
  usePublishingIdentitiesQuery: () => ({ data: mockIdentities, isLoading: !mockIdentities }),
}));
jest.mock('./activeProfileStore', () => ({
  getActiveProfileIdSnapshot: () => mockGlobalActiveId,
}));

type Selection = ReturnType<typeof usePublisherSelection>;

function mount(initialProfileId?: string | null) {
  const ref: { current: Selection | null } = { current: null };
  function Probe({ initial }: { initial?: string | null }) {
    ref.current = usePublisherSelection('clip', initial);
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Probe initial={initialProfileId} />);
  });
  return {
    get: () => ref.current!,
    rerender: () =>
      ReactTestRenderer.act(() => {
        renderer.update(<Probe initial={initialProfileId} />);
      }),
  };
}

beforeEach(() => {
  mockIdentities = [personal, lotus, fade];
  mockGlobalActiveId = 'b1';
});

describe('usePublisherSelection (composer preselect)', () => {
  it('preselects the global active profile for a new draft', () => {
    const view = mount();
    expect(view.get().identity?.id).toBe('b1');
    expect(view.get().needsSwitcher).toBe(true);
    expect(view.get().fallbackApplied).toBe(false);
  });

  it('never silently switches when the global profile changes later', () => {
    const view = mount();
    mockGlobalActiveId = 'b2';
    view.rerender();
    expect(view.get().identity?.id).toBe('b1');
  });

  it('lets the creator change the profile for this draft only', () => {
    const view = mount();
    ReactTestRenderer.act(() => view.get().select('u1'));
    expect(view.get().identity?.id).toBe('u1');
    ReactTestRenderer.act(() => view.get().select('missing'));
    expect(view.get().identity?.id).toBe('u1');
  });

  it('draft recovery keeps the draft profile even if the global profile differs', () => {
    mockGlobalActiveId = 'b2';
    const view = mount('b1');
    expect(view.get().identity?.id).toBe('b1');

    const restored = mount();
    expect(restored.get().identity?.id).toBe('b2');
    ReactTestRenderer.act(() => restored.get().restore('u1'));
    expect(restored.get().identity?.id).toBe('u1');
    mockGlobalActiveId = 'b1';
    restored.rerender();
    expect(restored.get().identity?.id).toBe('u1');
  });

  it('locks in the resolved profile once identities load', () => {
    mockIdentities = undefined;
    mockGlobalActiveId = null;
    const view = mount();
    expect(view.get().identity).toBeNull();
    mockIdentities = [lotus, personal];
    view.rerender();
    expect(view.get().identity?.id).toBe('u1');
    // The global profile changing after lock-in does not move the draft.
    mockGlobalActiveId = 'b1';
    view.rerender();
    expect(view.get().selectedId).toBe('u1');
  });

  it('falls back to personal (with a notice) when the profile is gone', () => {
    mockGlobalActiveId = 'deleted';
    const view = mount();
    expect(view.get().identity?.id).toBe('u1');
    expect(view.get().fallbackApplied).toBe(true);
  });
});
