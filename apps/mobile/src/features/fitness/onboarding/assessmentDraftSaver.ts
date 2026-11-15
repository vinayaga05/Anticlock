import type {
  FitnessAssessment,
  FitnessAssessmentPatch,
  FitnessProfile,
} from '@anticlock/contracts';
import { assessmentPatch, assessmentValueKey } from './assessmentModel';

export type AssessmentDraftState = {
  draft: FitnessAssessment;
  ready: boolean;
  status: 'loading' | 'saved' | 'waiting' | 'saving' | 'error';
  error: string | null;
  dirty: boolean;
  serverProfile: FitnessProfile | null;
};
type Writer = (
  patch: FitnessAssessmentPatch,
  signal: AbortSignal,
) => Promise<{ profile?: FitnessProfile } | void>;
type Waiter = { resolve: () => void; reject: (error: Error) => void };
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** An in-memory queue: one request at a time, latest edits coalesced, no local health storage. */
export class AssessmentDraftSaver {
  private saved: FitnessAssessment = {};
  private current: FitnessAssessment;
  private ready = false;
  private active = false;
  private activeController: AbortController | undefined;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private editedBeforeHydration = new Set<keyof FitnessAssessment>();
  private uncertain = new Set<keyof FitnessAssessment>();
  private listeners = new Set<(state: AssessmentDraftState) => void>();
  private waiters: Waiter[] = [];
  private state: AssessmentDraftState;

  constructor(
    private write: Writer,
    defaults: FitnessAssessment,
    private delayMs = 650,
  ) {
    this.current = clone(defaults);
    this.state = {
      draft: this.current,
      ready: false,
      status: 'loading',
      error: null,
      dirty: false,
      serverProfile: null,
    };
  }
  getSnapshot = () => this.state;
  resume() {
    this.stopped = false;
    if (
      this.ready &&
      this.editedBeforeHydration.size &&
      this.hasChanges() &&
      !this.active
    )
      this.schedule();
  }
  subscribe = (listener: (state: AssessmentDraftState) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  hasChanges = () =>
    this.active ||
    (this.editedBeforeHydration.size > 0 &&
      Object.keys(this.pendingPatch()).length > 0);
  private pendingPatch(): FitnessAssessmentPatch {
    const patch = assessmentPatch(this.saved, this.current);
    // A failed acknowledgement may still have reached the server. Reassert the
    // latest answer even when it was changed back to the previous saved value.
    for (const key of this.uncertain)
      (patch as Record<string, unknown>)[key] =
        this.current[key] === undefined ? null : this.current[key];
    return patch;
  }
  private publish(change: Partial<AssessmentDraftState> = {}) {
    if (this.stopped) return;
    this.state = {
      ...this.state,
      ...change,
      draft: clone(this.current),
      ready: this.ready,
      dirty: this.ready && this.hasChanges(),
    };
    this.listeners.forEach(listener => listener(this.state));
  }
  hydrate(profile: FitnessProfile | null) {
    if (this.ready || this.stopped) return;
    const local = this.current;
    this.saved = clone(profile?.assessment ?? {});
    this.current = profile ? clone(this.saved) : { ...this.current };
    for (const key of this.editedBeforeHydration) {
      if (local[key] === undefined) delete this.current[key];
      else (this.current as Record<string, unknown>)[key] = local[key];
    }
    this.ready = true;
    // Merely opening a profile must not invalidate its completed assessment.
    this.publish({
      status: this.hasChanges() || !profile ? 'waiting' : 'saved',
      serverProfile: profile,
    });
    if (this.editedBeforeHydration.size) this.schedule();
  }
  update<K extends keyof FitnessAssessment>(
    key: K,
    value: FitnessAssessment[K],
  ) {
    if (
      this.stopped ||
      assessmentValueKey(this.current[key]) === assessmentValueKey(value)
    )
      return;
    this.current = { ...this.current };
    if (value === undefined) delete this.current[key];
    else this.current[key] = value;
    this.editedBeforeHydration.add(key);
    this.publish({ status: 'waiting', error: null });
    if (this.ready) this.schedule();
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.pump();
    }, this.delayMs);
  }
  flush = (): Promise<void> => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.stopped)
      return Promise.reject(new Error('This assessment is no longer open.'));
    if (!this.ready)
      return Promise.reject(new Error('Wait for your saved answers to load.'));
    if (!this.hasChanges()) {
      this.publish({
        status: this.state.serverProfile ? 'saved' : 'waiting',
        error: null,
      });
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      void this.pump();
    });
  };
  private async pump() {
    if (this.stopped || !this.ready || this.active) return;
    const patch = this.pendingPatch();
    if (!Object.keys(patch).length) {
      this.publish({ status: 'saved', error: null });
      this.waiters.splice(0).forEach(waiter => waiter.resolve());
      return;
    }
    const sent = clone(this.current);
    const controller = new AbortController();
    this.activeController = controller;
    this.active = true;
    this.publish({ status: 'saving', error: null });
    try {
      const response = await this.write(patch, controller.signal);
      if (this.activeController === controller)
        this.activeController = undefined;
      if (this.stopped) {
        this.active = false;
        return;
      }
      const acknowledged = response?.profile?.assessment
        ? clone(response.profile.assessment)
        : { ...this.saved };
      if (!response?.profile?.assessment)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null)
            delete (acknowledged as Record<string, unknown>)[key];
          else (acknowledged as Record<string, unknown>)[key] = value;
        }
      // Normalize untouched fields without replacing anything edited during the request.
      const next = { ...this.current };
      for (const key of new Set([
        ...Object.keys(sent),
        ...Object.keys(acknowledged),
      ])) {
        const name = key as keyof FitnessAssessment;
        if (
          assessmentValueKey(this.current[name]) !==
          assessmentValueKey(sent[name])
        )
          continue;
        if (acknowledged[name] === undefined) delete next[name];
        else (next as Record<string, unknown>)[name] = acknowledged[name];
      }
      this.saved = acknowledged;
      this.uncertain.clear();
      this.current = next;
      this.active = false;
      this.publish({
        status: this.hasChanges() ? 'waiting' : 'saved',
        error: null,
        ...(response?.profile ? { serverProfile: response.profile } : {}),
      });
      // Keep the latest typing debounce unless an explicit flush is waiting.
      if (this.waiters.length || !this.hasChanges()) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        await this.pump();
      } else if (!this.timer) {
        await this.pump();
      }
    } catch (problem) {
      if (this.activeController === controller)
        this.activeController = undefined;
      if (this.stopped) {
        this.active = false;
        return;
      }
      this.active = false;
      for (const key of Object.keys(patch))
        this.uncertain.add(key as keyof FitnessAssessment);
      const error =
        problem instanceof Error
          ? problem
          : new Error('Could not save yet. Your answers are still here.');
      this.publish({ status: 'error', error: error.message });
      this.waiters.splice(0).forEach(waiter => waiter.reject(error));
    }
  }
  dispose() {
    this.stopped = true;
    this.activeController?.abort();
    this.activeController = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.listeners.clear();
    this.waiters
      .splice(0)
      .forEach(waiter =>
        waiter.reject(new Error('This assessment is no longer open.')),
      );
  }
}
