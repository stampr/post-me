import { Logger } from './logger';
import { Message } from './message';

export interface ISupportedWindow {
  postMessage: Window['postMessage'];
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
}

export function isWindow(w: unknown): w is ISupportedWindow {
  return true;
  // if (!w || typeof w !== 'object' || Array.isArray(w)) {
  //   return false;
  // }
  // console.log('isWindow', { w, window, sameWindow: w === window, name: `Name: ${(w as any)?.constructor?.name}` });
  // const { postMessage, addEventListener, removeEventListener } = w as Record<
  //   string | symbol | number,
  //   unknown
  // >;
  // return (
  //   typeof postMessage === 'function' &&
  //   typeof addEventListener === 'function' &&
  //   typeof removeEventListener === 'function'
  // );
}

export function makeWindowPostMessage(
  logger: Logger,
  w: Window,
  origin: string
) {
  return (message: Message<any>) => {
    logger('message received', { w, origin, message });
    w.postMessage(message, origin);
  };
}

export function makeWebWorkerPostMessage(
  logger: Logger,
  w: Worker | DedicatedWorkerGlobalScope
) {
  return (message: Message<any>) => {
    logger('message received', { w, message });
    w.postMessage(message);
  };
}

export function makeWindowAddMessageListener(
  logger: Logger,
  w: Window,
  acceptedOrigin: string
) {
  const acceptEvent = (event: MessageEvent) => {
    logger('acceptEvent', { w, acceptedOrigin, event });
    const { origin } = event;

    if (origin !== acceptedOrigin && acceptedOrigin !== '*') {
      logger('acceptEvent -> false');
      return false;
    }

    logger('acceptEvent -> true');
    return true;
  };
  return (listener: (event: MessageEvent) => void) => {
    const outerListener = (event: MessageEvent) => {
      logger('outerListener event received', { w, acceptedOrigin, event });
      if (acceptEvent(event)) {
        logger('outerListener calling inner listener', {
          w,
          acceptedOrigin,
          event,
        });
        listener(event);
      }
    };

    logger('attaching listener');
    w.addEventListener('message', outerListener);

    const removeListener = () => {
      logger('removeListener called', {
        w,
        window,
        isThisWindow: w === window,
      });
      w.removeEventListener('message', outerListener);
    };

    return removeListener;
  };
}

export function makeWebWorkerAddMessageListener(
  logger: Logger,
  w: Worker | WorkerGlobalScope
) {
  const acceptEvent = (_event: MessageEvent) => {
    logger('acceptEvent -> true', { w });
    return true;
  };
  return (listener: (message: MessageEvent) => void) => {
    const outerListener = (event: any) => {
      logger(
        'makeWebWorkerAddMessageListener -> outerListener event received',
        { w, event }
      );
      if (acceptEvent(event)) {
        logger('outerListener calling inner listener', { w, event });
        listener(event);
      }
    };

    logger('attaching listener');
    w.addEventListener('message', outerListener);

    const removeListener = () => {
      logger('removeListener called');
      w.removeEventListener('message', outerListener);
    };

    return removeListener;
  };
}

export function runUntil(
  logger: Logger,
  worker: () => void,
  condition: () => boolean,
  attemptInterval = 50
): void {
  logger('runUntil', { worker, condition, attemptInterval });
  const fn = () => {
    worker();
    if (!condition()) {
      setTimeout(fn, attemptInterval);
    }
  };
  fn();
}
