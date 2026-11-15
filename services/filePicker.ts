/**
 * Opens the system file chooser and returns the chosen file (null if cancelled).
 * The input is added to the page until the choice is made: iPhone Safari may never report
 * the choice of a file input that is not in the page, and the button then seems to do nothing.
 */
export function pickFile(accept: string): Promise<File | null> {
  // A chooser closed without any event (older browsers) leaves its input behind: clear it now.
  document.querySelectorAll('input[data-haven-file-picker]').forEach(previous => previous.remove());
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.dataset.havenFilePicker = '';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    // Off-screen rather than display:none, which some mobile browsers refuse to open.
    input.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
