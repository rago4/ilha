// =============================================================================
// @ilha/store — zustand-shaped reactive store backed by alien-signals
// =============================================================================

import { signal, computed, effect } from "alien-signals";
import type { RawHtml } from "ilha";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetState<T> {
  (update: Partial<T>): void;
  (updater: (state: T) => Partial<T>): void;
}

export type GetState<T> = () => T;
export type Listener<T> = (state: T, prevState: T) => void;
export type SliceListener<_T, S> = (slice: S, prevSlice: S) => void;
export type Unsub = () => void;

/** Accepted render output — either a plain string or an ilha RawHtml value. */
export type RenderResult = string | RawHtml;

export interface StoreApi<T extends object> {
  setState(update: Partial<T> | ((state: T) => Partial<T>)): void;
  getState(): T;
  getInitialState(): T;
  subscribe(listener: Listener<T>): Unsub;
  subscribe<S>(selector: (state: T) => S, listener: SliceListener<T, S>): Unsub;
  bind(el: Element, render: (state: T) => RenderResult): Unsub;
  bind<S>(el: Element, selector: (state: T) => S, render: (slice: S) => RenderResult): Unsub;
}

// ---------------------------------------------------------------------------
// ActionsCreator
// ---------------------------------------------------------------------------

type ActionsCreator<TState extends object, TActions extends object> = (
  set: SetState<TState>,
  get: GetState<any>,
  getInitialState: () => TState,
) => TActions;

// ---------------------------------------------------------------------------
// Internal helper — unwrap RenderResult to an HTML string
// ---------------------------------------------------------------------------

function unwrap(result: RenderResult): string {
  if (typeof result === "string") return result;
  return result.value;
}

// ---------------------------------------------------------------------------
// createStore
// ---------------------------------------------------------------------------

export function createStore<TState extends object>(initialState: TState): StoreApi<TState>;

export function createStore<TState extends object, TActions extends object>(
  initialState: TState,
  actions: ActionsCreator<TState, TActions>,
): StoreApi<TState & TActions>;

export function createStore<TState extends object, TActions extends object = Record<never, never>>(
  initialState: TState,
  actionsCreator?: ActionsCreator<TState, TActions>,
): StoreApi<TState & TActions> {
  type T = TState & TActions;

  const stateSignal = signal<T>({} as T);

  function setState(update: Partial<T> | ((state: T) => Partial<T>)): void {
    const current = stateSignal();
    const patch = typeof update === "function" ? update(current) : update;
    stateSignal({ ...current, ...patch });
  }

  function getState(): T {
    return stateSignal();
  }

  function subscribe(listener: Listener<T>): Unsub;
  function subscribe<S>(selector: (state: T) => S, listener: SliceListener<T, S>): Unsub;
  function subscribe<S>(
    listenerOrSelector: Listener<T> | ((state: T) => S),
    maybeListener?: SliceListener<T, S>,
  ): Unsub {
    if (maybeListener === undefined) {
      const listener = listenerOrSelector as Listener<T>;
      let prev = stateSignal();
      let first = true;
      return effect(() => {
        const current = stateSignal();
        if (first) {
          first = false;
          return;
        }
        listener(current, prev);
        prev = current;
      });
    }

    const selector = listenerOrSelector as (state: T) => S;
    const sliceComputed = computed(() => selector(stateSignal()));
    let prevSlice = sliceComputed();
    let first = true;
    return effect(() => {
      const currentSlice = sliceComputed();
      if (first) {
        first = false;
        return;
      }
      if (!Object.is(currentSlice, prevSlice)) {
        maybeListener(currentSlice, prevSlice);
        prevSlice = currentSlice;
      }
    });
  }

  function bind(el: Element, render: (state: T) => RenderResult): Unsub;
  function bind<S>(
    el: Element,
    selector: (state: T) => S,
    render: (slice: S) => RenderResult,
  ): Unsub;
  function bind<S>(
    el: Element,
    renderOrSelector: ((state: T) => RenderResult) | ((state: T) => S),
    maybeRender?: (slice: S) => RenderResult,
  ): Unsub {
    if (maybeRender === undefined) {
      return effect(() => {
        el.innerHTML = unwrap((renderOrSelector as (state: T) => RenderResult)(stateSignal()));
      });
    }
    const sliceComputed = computed(() => (renderOrSelector as (state: T) => S)(stateSignal()));
    return effect(() => {
      el.innerHTML = unwrap(maybeRender(sliceComputed()));
    });
  }

  let resolvedInitialState: T;

  const api: StoreApi<T> = {
    setState,
    getState,
    getInitialState: () => resolvedInitialState,
    subscribe,
    bind,
  };

  const resolvedActions = actionsCreator
    ? actionsCreator(
        setState as unknown as SetState<TState>,
        getState as GetState<any>,
        () => resolvedInitialState as unknown as TState,
      )
    : ({} as TActions);

  resolvedInitialState = { ...initialState, ...resolvedActions };
  stateSignal(resolvedInitialState);

  return api;
}

export { effectScope } from "alien-signals";
