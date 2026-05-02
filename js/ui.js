/**
 * ui.js — UI 상호작용 + 클립보드 복사
 */

/**
 * 텍스트를 클립보드에 복사 (iOS Safari fallback 포함)
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  // Modern Clipboard API
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fallback
    }
  }

  // iOS Safari fallback — execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);

    // iOS 전용
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textarea.setSelectionRange(0, 999999);
    } else {
      textarea.select();
    }

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    return false;
  }
}

/**
 * 파일 드래그앤드롭 + 파일 선택 초기화
 * @param {HTMLElement} dropZone
 * @param {HTMLInputElement} fileInput
 * @param {Function} onFile - callback(file: File)
 */
function initFilePicker(dropZone, fileInput, onFile) {
  // 파일 선택 버튼
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      onFile(fileInput.files[0]);
    }
  });

  // 드래그앤드롭
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });

  // 드롭존 클릭 → 파일 선택
  dropZone.addEventListener('click', () => fileInput.click());
}

/**
 * 텍스트 파일 읽기
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

// CommonJS / browser 호환
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { copyToClipboard, initFilePicker, readFileAsText };
}
