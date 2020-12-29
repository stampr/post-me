import { IdType } from './common';
import { MethodsType } from './handle';
import { Connection, ConcreteConnection } from './connection';
import {
  createHandshakeMessage,
  isHandshakeMessage,
  createResponsMessage,
  isResponseMessage,
  Message,
} from './message';
import {
  makeWindowPostMessage,
  makeWebWorkerAddMessageListener,
  makeWebWorkerPostMessage,
  makeWindowAddMessageListener,
  runUntil,
  isWindow,
} from './handshake.utils';
import debug from 'debug';

const _logger = debug('postme:handshake');

const uniqueSessionId: () => IdType = (() => {
  let __sessionId = 0;
  return () => {
    const sessionId = __sessionId;
    __sessionId += 1;
    return sessionId;
  };
})();

export const HANDSHAKE_SUCCESS = '@post-me/handshake-success';

export function ParentHandshake<M0 extends MethodsType>(
  localMethods: M0,
  otherWindow: Window | Worker,
  acceptedOrigin: string,
  _thisWindow?: Window | DedicatedWorkerGlobalScope
): Promise<Connection> {
  const logger = _logger.bind(_logger, 'PARENT');
  logger('starting', {
    localMethods,
    otherWindow,
    acceptedOrigin,
    _thisWindow,
  });
  const thisWindow = _thisWindow || window;

  const thisSessionId = uniqueSessionId();
  logger('session', thisSessionId);

  return new Promise<ConcreteConnection<M0>>((resolve, reject) => {
    let postMessage: ((message: Message<any>) => void) | undefined;
    let addMessageListener:
      | ((listener: (event: MessageEvent) => void) => () => void)
      | undefined;

    if (isWindow(otherWindow)) {
      logger('postMessage; otherWindow = Window');
      postMessage = makeWindowPostMessage(
        logger.bind(logger, 'makeWindowPostMessage'),
        otherWindow,
        acceptedOrigin
      );
    } else {
      logger('postMessage; otherWindow = unknown (web worker?)');
      postMessage = makeWebWorkerPostMessage(
        logger.bind(logger, 'makeWebWorkerPostMessage'),
        otherWindow
      );
    }

    if (isWindow(thisWindow) && isWindow(otherWindow)) {
      logger('addMessageListener; window listener');
      addMessageListener = makeWindowAddMessageListener(
        logger,
        thisWindow,
        acceptedOrigin
      );
    }

    if (isWindow(thisWindow) && !isWindow(otherWindow)) {
      logger('addMessageListener; web worker listener');
      addMessageListener = makeWebWorkerAddMessageListener(
        logger.bind(logger, 'makeWebWorkerAddMessageListener'),
        otherWindow
      );
    }

    if (postMessage === undefined || addMessageListener === undefined) {
      reject(new Error('post-me does not work yet with this type of worker.'));
      return;
    }

    let removeHandshakeListener: () => void;
    let connected = false;

    const handshakeListener = (event: MessageEvent) => {
      const { data } = event;
      logger('listener received event', { event });

      if (isResponseMessage(data)) {
        const { sessionId, requestId, result } = data;
        logger('listener isResponseMessage', { sessionId, requestId, result });

        if (
          sessionId === thisSessionId &&
          requestId === thisSessionId &&
          result === HANDSHAKE_SUCCESS
        ) {
          logger('we are the recipipent');
          connected = true;
          removeHandshakeListener();
          logger('finalizing Connection');
          resolve(
            new ConcreteConnection(
              localMethods,
              postMessage as (message: Message<any>) => void,
              addMessageListener as (
                listener: (event: MessageEvent) => void
              ) => () => void,
              sessionId
            )
          );
        }
      }
    };

    removeHandshakeListener = addMessageListener(handshakeListener);

    runUntil(
      logger.bind(logger, 'runUntil'),
      () => {
        const message = createHandshakeMessage(thisSessionId);
        (postMessage as any)(message);
      },
      () => connected
    );
  });
}

export function ChildHandshake<M0 extends MethodsType>(
  localMethods: M0,
  acceptedOrigin: string,
  _thisWindow?: Window | DedicatedWorkerGlobalScope
): Promise<Connection> {
  const logger = _logger.bind(_logger, 'CHILD');
  logger('starting', { localMethods, acceptedOrigin, _thisWindow });
  const thisWindow = _thisWindow || window;

  return new Promise<ConcreteConnection<M0>>((resolve, reject) => {
    let postMessage: ((message: Message<any>) => void) | undefined;
    let addMessageListener:
      | ((listener: (event: MessageEvent) => void) => () => void)
      | undefined;

    if (isWindow(thisWindow)) {
      logger('addMessageListener; thisWindow = Window');
      addMessageListener = makeWindowAddMessageListener(
        logger.bind(logger, 'makeWindowAddMessageListener'),
        thisWindow,
        acceptedOrigin
      );
    } else {
      logger('addMessageListener; thisWindow = unknown (web worker?)');
      addMessageListener = makeWebWorkerAddMessageListener(
        logger.bind(logger, 'makeWebWorkerAddMessageListener'),
        thisWindow
      );
    }

    if (addMessageListener === undefined) {
      reject(new Error('post-me does not work yet with this type of worker.'));
      return;
    }

    let removeHandshakeListener: () => void;
    let connected = false;

    const handshakeListener = (event: MessageEvent) => {
      const { source, data } = event;
      logger('listener received event', { event });

      if (isHandshakeMessage(data)) {
        logger('handshake message detected');
        connected = true;
        removeHandshakeListener();

        if (source && isWindow(source)) {
          logger('source is window');
          postMessage = makeWindowPostMessage(
            logger.bind(logger, 'makeWindowPostMessage'),
            source as any,
            acceptedOrigin
          );
        } else if (!source && !isWindow(thisWindow)) {
          logger('no source, or source is not window');
          postMessage = makeWebWorkerPostMessage(
            logger.bind(logger, 'makeWebWorkerPostMessage'),
            thisWindow
          );
        }

        if (postMessage === undefined) {
          reject(
            new Error('post-me does not work yet with this type of worker.')
          );
          return;
        }

        const { sessionId, requestId } = data;

        const message = createResponsMessage(
          sessionId,
          requestId,
          HANDSHAKE_SUCCESS
        );
        logger('sending handshake message', { message });
        postMessage(message);

        logger('finalizing Connection');
        resolve(
          new ConcreteConnection(
            localMethods,
            postMessage,
            addMessageListener as (
              listener: (event: MessageEvent) => void
            ) => () => void,
            sessionId
          )
        );
      }
    };

    removeHandshakeListener = addMessageListener(handshakeListener);
  });
}
