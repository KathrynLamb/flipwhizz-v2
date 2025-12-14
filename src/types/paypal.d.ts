export {};

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: any) => { render: (selector: string) => void };
    };
  }
}
