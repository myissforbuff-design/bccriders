import { useEffect, useRef } from 'react';

type ModalEntry = {
  id: string;
  onClose: () => void;
  pushedHistory: boolean;
};

const modalStack: ModalEntry[] = [];
let isGlobalListenerAttached = false;
let isProgrammaticBack = false;

function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.key === 'Escape' || e.key === 'Esc') && modalStack.length > 0) {
    e.preventDefault();
    e.stopPropagation();
    const top = modalStack[modalStack.length - 1];
    top.onClose();
  }
}

function handleGlobalPopState(_e: PopStateEvent) {
  if (isProgrammaticBack) {
    isProgrammaticBack = false;
    return;
  }
  if (modalStack.length > 0) {
    const top = modalStack.pop();
    if (top) {
      top.pushedHistory = false;
      top.onClose();
    }
  }
}

export function isModalOpen(): boolean {
  return modalStack.length > 0;
}

export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    if (!isGlobalListenerAttached) {
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      window.addEventListener('popstate', handleGlobalPopState);
      isGlobalListenerAttached = true;
    }

    const id = 'modal_' + Math.random().toString(36).substring(2, 9);

    try {
      window.history.pushState({ modalId: id }, '');
    } catch {
      // ignore pushState errors if constrained
    }

    const entry: ModalEntry = {
      id,
      onClose: () => onCloseRef.current(),
      pushedHistory: true,
    };

    modalStack.push(entry);

    return () => {
      const index = modalStack.findIndex((item) => item.id === id);
      if (index !== -1) {
        const [removed] = modalStack.splice(index, 1);
        if (removed.pushedHistory) {
          setTimeout(() => {
            if (window.history.state?.modalId === id) {
              isProgrammaticBack = true;
              try {
                window.history.back();
              } catch {
                isProgrammaticBack = false;
              }
            }
          }, 0);
        }
      }
    };
  }, [isOpen]);
}
