// Some dependencies expect Node's `global`. Was an inline script, now allowed by the CSP.
(window as unknown as { global: Window }).global = window;

export {};
