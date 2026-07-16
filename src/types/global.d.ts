import type { DetailedHTMLProps, HTMLAttributes } from "react";

export {};

declare global {
  interface Window {
    nostur: {
      clearCache: (partitionName: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      setMainZoom: (zoomFactor: number) => Promise<boolean>;

      onPasswordResetLink: (
        callback: (payload: { url?: string }) => void
      ) => () => void;

      openDownloadedFile: (filePath: string) => Promise<boolean>;
      showDownloadedFile: (filePath: string) => Promise<boolean>;

      notify: (payload: {
        title: string;
        body: string;
        conversationId?: string;
        messageId?: string;
      }) => Promise<boolean>;

      playNotificationSound: (payload: {
        kind: "nuevo" | "gestion" | "cande_transfer";
      }) => Promise<boolean>;

      onNewTabFromMain: (
        callback: (payload: string | { url?: string; title?: string; appId?: string }) => void
      ) => () => void;

      onOpenConversationFromNotification: (
        callback: (payload: { conversationId: string }) => void
      ) => () => void;

      onDownloadStarted: (
        callback: (payload: {
          filename?: string;
          path?: string;
          folder?: string;
          partitionName?: string;
          state?: string;
          receivedBytes?: number;
          totalBytes?: number;
        }) => void
      ) => () => void;

      onDownloadUpdated: (
        callback: (payload: {
          filename?: string;
          path?: string;
          folder?: string;
          partitionName?: string;
          state?: string;
          receivedBytes?: number;
          totalBytes?: number;
        }) => void
      ) => () => void;

      onDownloadDone: (
        callback: (payload: {
          filename?: string;
          path?: string;
          folder?: string;
          partitionName?: string;
          state?: string;
          receivedBytes?: number;
          totalBytes?: number;
          error?: string;
          fileExists?: boolean;
          fileSize?: number;
        }) => void
      ) => () => void;
    };
  }

  declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

type NosturWebview = HTMLElement & {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  reloadIgnoringCache: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  loadURL: (url: string) => Promise<void>;
  executeJavaScript: (code: string) => Promise<unknown>;

  setZoomFactor?: (factor: number) => void;
  getZoomFactor?: () => number;
};

  type NosturDidNavigateEvent = Event & {
    url: string;
  };

  type NosturDidNavigateInPageEvent = Event & {
    url: string;
  };

  type NosturPageTitleUpdatedEvent = Event & {
    title: string;
  };

  type NosturPageFaviconUpdatedEvent = Event & {
    favicons?: string[];
  };

  type NosturNewWindowEvent = Event & {
    url: string;
    preventDefault: () => void;
  };
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: boolean;
        webpreferences?: string;
        useragent?: string;
        className?: string;
        "data-tab-id"?: string;
      };
    }
  }
}

declare module "react/jsx-dev-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        allowpopups?: boolean;
        webpreferences?: string;
        useragent?: string;
        className?: string;
        "data-tab-id"?: string;
      };
    }
  }
}