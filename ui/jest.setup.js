import "@testing-library/jest-dom";
// import { server } from '../tests/ui/__mocks__/server'

// Mock Service Worker setup
// beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// afterEach(() => server.resetHandlers())
// afterAll(() => server.close())

// IntersectionObserver mock
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Next.js router mock
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return "/";
  },
}));

// WebRTC mock for file upload
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createDataChannel: jest.fn(),
  createOffer: jest.fn(),
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  close: jest.fn(),
}));

// File reader mock
global.FileReader = class FileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
  }

  readAsDataURL() {
    setTimeout(() => {
      this.result = "data:application/pdf;base64,dGVzdA==";
      this.onload && this.onload();
    }, 100);
  }
};

// Canvas mock for image processing
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawFocusIfNeeded: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  createRadialGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
}));

// Speech Synthesis mock
global.speechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => []),
  pending: false,
  speaking: false,
  paused: false,
};

// AbortController mock for fetch cancellation
global.AbortController = jest.fn().mockImplementation(() => ({
  abort: jest.fn(),
  signal: {
    aborted: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: jest.fn(),
});
