import { useCallback, useState } from 'react';

export interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UndoRedoActions<T> {
  set: (newPresent: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

const MAX_HISTORY = 50;

export function useUndoRedo<T>(initialState: T): [T, UndoRedoActions<T>] {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const set = useCallback((newPresent: T) => {
    setState((currentState) => {
      // Don't record if the state hasn't changed
      if (JSON.stringify(currentState.present) === JSON.stringify(newPresent)) {
        return currentState;
      }

      const newPast = [...currentState.past, currentState.present];

      // Keep only last MAX_HISTORY items
      if (newPast.length > MAX_HISTORY) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: newPresent,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) {
        return currentState;
      }

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) {
        return currentState;
      }

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState({
      past: [],
      present: state.present,
      future: [],
    });
  }, [state.present]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return [
    state.present,
    {
      set,
      undo,
      redo,
      canUndo,
      canRedo,
      clear,
    },
  ];
}
