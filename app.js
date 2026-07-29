/**
 * StegoCrypt – app.js
 * LSB Steganography + AES-GCM encryption, fully client-side
 * No external libraries required.
 */

"use strict";

/* =====================================================
   LSB STEGANOGRAPHY CORE
   ===================================================== */

const EOF_MARKER = '\u0003\u0003\u0003'; // 3x ETX chars = unique EOF

/**
 * Encode text into an ImageData using LSB.
 * @param {ImageData} imageData - source pixels (RGBA)
 * @param {string} message - text to embed
 * @param {function} onProgress - optional callback(0..1)
 * @returns {ImageData} modified image data
 */
function lsbEncode(imageData, message, onProgress) {
  const fullMsg = message + EOF_MARKER;
  // Convert to UTF-8 bytes then binary string
  const bytes = new TextEncoder().encode(fullMsg);
  let binary = '';
  for (const b of bytes) {
    binary += b.toString(2).padStart(8, '0');
  }

  const pixels = imageData.data; // RGBA flat array
  const totalBits = binary.length;
  const maxBits = Math.floor(pixels.length / 4) * 3; // 3 bits per pixel (R,G,B)

  if (totalBits > maxBits) {
    throw new Error(`Message too long! Needs ${totalBits} bits but image only holds ${maxBits} bits.`);
  }

  let bitIdx = 0;
  const pixelCount = pixels.length / 4;

  for (let px = 0; px < pixelCount; px++) {
    if (bitIdx >= totalBits) break;

    const base = px * 4; // RGBA index
    // Encode into R, G, B channels (not Alpha)
    for (let ch = 0; ch < 3; ch++) {
      if (bitIdx >= totalBits) break;
      pixels[base + ch] = (pixels[base + ch] & 0xFE) | parseInt(binary[bitIdx], 10);
      bitIdx++;
    }

    if (onProgress && px % 5000 === 0) {
      onProgress(bitIdx / totalBits);
    }
  }

  if (onProgress) onProgress(1);
  return imageData;
}

/**
 * Decode hidden text from ImageData using LSB.
 * @param {ImageData} imageData
 * @returns {string} decoded message (or empty string if nothing found)
 */
function lsbDecode(imageData) {
  const pixels = imageData.data;
  let binary = '';
  const pixelCount = pixels.length / 4;

  for (let px = 0; px < pixelCount; px++) {
    const base = px * 4;
    for (let ch = 0; ch < 3; ch++) {
      binary += (pixels[base + ch] & 1).toString();
    }
  }

  // Convert binary to bytes
  const resultBytes = [];
  for (let i = 0; i + 8 <= binary.length; i += 8) {
    resultBytes.push(parseInt(binary.slice(i, i + 8), 2));
  }

  const decoded = new TextDecoder().decode(new Uint8Array(resultBytes));

  // Find EOF marker
  const eofIdx = decoded.indexOf(EOF_MARKER);
  if (eofIdx === -1) return '';
  return decoded.slice(0, eofIdx);
}

/* =====================================================
   AES-GCM ENCRYPTION (Web Crypto API)
   ===================================================== */

/**
 * Derive a CryptoKey from a password using PBKDF2.
 */
async function deriveKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('stegocrypt-salt-v1'),
      iterations: 200000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string with AES-GCM.
 * Returns a base64 string: [iv(12 bytes) + ciphertext].
 */
async function encryptMessage(plaintext, password) {
  const key = await deriveKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 AES-GCM payload.
 */
async function decryptMessage(base64Token, password) {
  const combined = Uint8Array.from(atob(base64Token), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await deriveKey(password);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuffer);
}

/* =====================================================
   IMAGE UTILITIES
   ===================================================== */

/**
 * Load a File into an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('Failed to load image.')); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/**
 * Get ImageData from an image using an offscreen canvas.
 */
function imageToImageData(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

/**
 * Return max character capacity for an image (raw, unencrypted).
 */
function getCapacity(img) {
  const maxBits = img.naturalWidth * img.naturalHeight * 3;
  const overheadBits = new TextEncoder().encode(EOF_MARKER).length * 8;
  return Math.floor((maxBits - overheadBits) / 8);
}

/* =====================================================
   UI CONTROLLER
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* --- DOM references --- */
  const tabEncode   = document.getElementById('tab-encode');
  const tabDecode   = document.getElementById('tab-decode');
  const panelEncode = document.getElementById('encode-panel');
  const panelDecode = document.getElementById('decode-panel');
  const tabSlider   = document.getElementById('tab-slider');

  // Encode
  const encodeDrop         = document.getElementById('encode-drop');
  const encodeDropInner    = document.getElementById('encode-drop-inner');
  const encodeFileInput    = document.getElementById('encode-file-input');
  const encodePreview      = document.getElementById('encode-preview');
  const encodeImgInfo      = document.getElementById('encode-img-info');
  const encodeImgSize      = document.getElementById('encode-img-size');
  const encodeCapacity     = document.getElementById('encode-capacity');
  const encodeMessage      = document.getElementById('encode-message');
  const encodeCharCount    = document.getElementById('encode-char-count');
  const encodeCharsLeft    = document.getElementById('encode-chars-left');
  const encodeEncryptToggle= document.getElementById('encode-encrypt-toggle');
  const encodePassField    = document.getElementById('encode-pass-field');
  const encodePassword     = document.getElementById('encode-password');
  const encodePassEye      = document.getElementById('encode-pass-eye');
  const encodeBtn          = document.getElementById('encode-btn');
  const encodeProgressWrap = document.getElementById('encode-progress-wrap');
  const encodeProgressFill = document.getElementById('encode-progress-fill');
  const encodeProgressLabel= document.getElementById('encode-progress-label');
  const encodeResult       = document.getElementById('encode-result');
  const encodeResultCanvas = document.getElementById('encode-result-canvas');
  const encodeDownloadBtn  = document.getElementById('encode-download-btn');
  const encodeResetBtn     = document.getElementById('encode-reset-btn');
  const encodeError        = document.getElementById('encode-error');

  // Decode
  const decodeDrop         = document.getElementById('decode-drop');
  const decodeDropInner    = document.getElementById('decode-drop-inner');
  const decodeFileInput    = document.getElementById('decode-file-input');
  const decodePreview      = document.getElementById('decode-preview');
  const decodeEncryptToggle= document.getElementById('decode-encrypt-toggle');
  const decodePassField    = document.getElementById('decode-pass-field');
  const decodePassword     = document.getElementById('decode-password');
  const decodePassEye      = document.getElementById('decode-pass-eye');
  const decodeBtn          = document.getElementById('decode-btn');
  const decodeProgressWrap = document.getElementById('decode-progress-wrap');
  const decodeProgressFill = document.getElementById('decode-progress-fill');
  const decodeProgressLabel= document.getElementById('decode-progress-label');
  const decodeResult       = document.getElementById('decode-result');
  const decodeMessageOut   = document.getElementById('decode-message-out');
  const decodeDownloadBtn  = document.getElementById('decode-download-btn');
  const decodeCopyBtn      = document.getElementById('decode-copy-btn');
  const decodeResetBtn     = document.getElementById('decode-reset-btn');
  const decodeNoMsg        = document.getElementById('decode-no-msg');
  const decodeError        = document.getElementById('decode-error');

  // Hero buttons
  const heroEncodeBtn      = document.getElementById('hero-encode-btn');
  const heroDecodeBtn      = document.getElementById('hero-decode-btn');

  // Nav links
  const navEncode          = document.getElementById('nav-encode');
  const navDecode          = document.getElementById('nav-decode');

  /* --- State --- */
  let encodedImage = null;   // loaded HTMLImageElement for encoding
  let decodedImage = null;   // loaded HTMLImageElement for decoding
  let maxCapacity  = 0;      // max chars for current encode image

  /* =====================
     TAB SWITCHING
     ===================== */

  function switchTab(tab) {
    if (tab === 'encode') {
      panelEncode.classList.add('active');
      panelDecode.classList.remove('active');
      tabEncode.classList.add('active');
      tabDecode.classList.remove('active');
      tabEncode.setAttribute('aria-selected', 'true');
      tabDecode.setAttribute('aria-selected', 'false');
      navEncode.classList.add('active');
      navDecode.classList.remove('active');
      positionSlider(tabEncode);
    } else {
      panelEncode.classList.remove('active');
      panelDecode.classList.add('active');
      tabEncode.classList.remove('active');
      tabDecode.classList.add('active');
      tabEncode.setAttribute('aria-selected', 'false');
      tabDecode.setAttribute('aria-selected', 'true');
      navEncode.classList.remove('active');
      navDecode.classList.add('active');
      positionSlider(tabDecode);
    }
    document.getElementById('tool').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function positionSlider(activeBtn) {
    const switcher = activeBtn.closest('.tab-switcher');
    const switcherRect = switcher.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    tabSlider.style.left   = (btnRect.left - switcherRect.left) + 'px';
    tabSlider.style.top    = (btnRect.top - switcherRect.top) + 'px';
    tabSlider.style.width  = btnRect.width + 'px';
    tabSlider.style.height = btnRect.height + 'px';
  }

  // Init slider position
  setTimeout(() => positionSlider(tabEncode), 50);

  tabEncode.addEventListener('click', () => switchTab('encode'));
  tabDecode.addEventListener('click', () => switchTab('decode'));

  heroEncodeBtn.addEventListener('click', () => switchTab('encode'));
  heroDecodeBtn.addEventListener('click', () => switchTab('decode'));

  navEncode.addEventListener('click', (e) => { e.preventDefault(); switchTab('encode'); });
  navDecode.addEventListener('click', (e) => { e.preventDefault(); switchTab('decode'); });

  /* =====================
     DROP ZONE HELPERS
     ===================== */

  function setupDropZone(dropEl, fileInput, previewEl, dropInner, onFile) {
    // Click to open file picker
    dropEl.addEventListener('click', (e) => {
      if (e.target === dropEl || e.target.closest('.drop-inner') || e.target === previewEl) {
        fileInput.click();
      }
    });

    dropEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });

    dropEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropEl.classList.add('drag-over');
    });

    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));

    dropEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropEl.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFile(file);
    });

    function handleFile(file) {
      const url = URL.createObjectURL(file);
      previewEl.src = url;
      previewEl.style.display = 'block';
      dropInner.style.display = 'none';
      dropEl.classList.add('has-image');
      onFile(file);
    }
  }

  /* =====================
     ENCODE SECTION
     ===================== */

  setupDropZone(encodeDrop, encodeFileInput, encodePreview, encodeDropInner, async (file) => {
    encodeError.classList.add('hidden');
    try {
      encodedImage = await loadImage(file);
      const capacity = getCapacity(encodedImage);
      maxCapacity = capacity;

      encodeImgSize.textContent = `${encodedImage.naturalWidth} × ${encodedImage.naturalHeight}`;
      encodeCapacity.textContent = `Up to ${capacity.toLocaleString()} chars`;
      encodeImgInfo.style.display = 'flex';

      updateCharCounter();
      updateEncodeBtn();
    } catch (err) {
      showError(encodeError, err.message);
    }
  });

  function updateCharCounter() {
    const len = new TextEncoder().encode(encodeMessage.value).length;
    encodeCharCount.textContent = encodeMessage.value.length;
    if (maxCapacity > 0) {
      const left = maxCapacity - len;
      encodeCharsLeft.textContent = left >= 0 ? left.toLocaleString() : '⚠️ Too long!';
      encodeCharsLeft.style.color = left < 0 ? 'var(--clr-error)' : '';
    }
  }

  encodeMessage.addEventListener('input', () => {
    updateCharCounter();
    updateEncodeBtn();
  });

  encodeEncryptToggle.addEventListener('change', () => {
    encodePassField.classList.toggle('hidden', !encodeEncryptToggle.checked);
    encodeEncryptToggle.setAttribute('aria-expanded', encodeEncryptToggle.checked);
  });

  setupPasswordToggle(encodePassEye, encodePassword);

  function updateEncodeBtn() {
    const hasImage = !!encodedImage;
    const hasMsg = encodeMessage.value.trim().length > 0;
    encodeBtn.disabled = !(hasImage && hasMsg);
  }

  encodeBtn.addEventListener('click', async () => {
    const message = encodeMessage.value.trim();
    const useEncrypt = encodeEncryptToggle.checked;
    const password = encodePassword.value;

    encodeError.classList.add('hidden');
    encodeResult.classList.add('hidden');

    if (!encodedImage || !message) return;
    if (useEncrypt && !password) {
      showError(encodeError, 'Please enter a password for encryption.'); return;
    }

    // Lock UI
    setBtnLoading(encodeBtn, true);
    encodeProgressWrap.classList.remove('hidden');
    setProgress(encodeProgressFill, encodeProgressLabel, 0, 'Preparing...');

    try {
      let msgToEmbed = message;

      if (useEncrypt) {
        setProgress(encodeProgressFill, encodeProgressLabel, 5, 'Encrypting with AES-GCM...');
        msgToEmbed = await encryptMessage(message, password);
      }

      // Verify capacity
      const msgBytes = new TextEncoder().encode(msgToEmbed + EOF_MARKER).length;
      const maxBytes = Math.floor(encodedImage.naturalWidth * encodedImage.naturalHeight * 3 / 8);
      if (msgBytes > maxBytes) {
        throw new Error(`Message too long for this image (${msgBytes} bytes needed, ${maxBytes} available). Use a shorter message or a larger image.`);
      }

      setProgress(encodeProgressFill, encodeProgressLabel, 10, 'Embedding message...');

      // Use setTimeout to let the UI update before heavy computation
      await new Promise(resolve => setTimeout(resolve, 20));

      const { canvas, ctx, imageData } = imageToImageData(encodedImage);

      lsbEncode(imageData, msgToEmbed, (p) => {
        setProgress(encodeProgressFill, encodeProgressLabel, 10 + p * 85, `Encoding… ${Math.round(p * 100)}%`);
      });

      ctx.putImageData(imageData, 0, 0);

      // Copy to result canvas
      encodeResultCanvas.width  = canvas.width;
      encodeResultCanvas.height = canvas.height;
      const rCtx = encodeResultCanvas.getContext('2d');
      rCtx.drawImage(canvas, 0, 0);

      // Save blob for download
      encodedImage._resultCanvas = canvas;

      setProgress(encodeProgressFill, encodeProgressLabel, 100, 'Done!');
      await new Promise(r => setTimeout(r, 300));

      encodeProgressWrap.classList.add('hidden');
      encodeResult.classList.remove('hidden');

    } catch (err) {
      encodeProgressWrap.classList.add('hidden');
      showError(encodeError, err.message);
    } finally {
      setBtnLoading(encodeBtn, false);
    }
  });

  encodeDownloadBtn.addEventListener('click', () => {
    if (!encodedImage || !encodedImage._resultCanvas) return;
    encodedImage._resultCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stego_image.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  encodeResetBtn.addEventListener('click', resetEncode);

  function resetEncode() {
    encodedImage = null;
    maxCapacity = 0;
    encodeFileInput.value = '';
    encodePreview.src = '';
    encodePreview.style.display = 'none';
    encodeDropInner.style.display = '';
    encodeDrop.classList.remove('has-image', 'drag-over');
    encodeMessage.value = '';
    encodeCharCount.textContent = '0';
    encodeCharsLeft.textContent = '–';
    encodeImgInfo.style.display = 'none';
    encodeEncryptToggle.checked = false;
    encodePassField.classList.add('hidden');
    encodePassword.value = '';
    encodeResult.classList.add('hidden');
    encodeError.classList.add('hidden');
    encodeProgressWrap.classList.add('hidden');
    encodeBtn.disabled = true;
  }

  /* =====================
     DECODE SECTION
     ===================== */

  setupDropZone(decodeDrop, decodeFileInput, decodePreview, decodeDropInner, async (file) => {
    decodeError.classList.add('hidden');
    decodeNoMsg.classList.add('hidden');
    decodeResult.classList.add('hidden');
    try {
      decodedImage = await loadImage(file);
      decodeBtn.disabled = false;
    } catch (err) {
      showError(decodeError, err.message);
    }
  });

  decodeEncryptToggle.addEventListener('change', () => {
    decodePassField.classList.toggle('hidden', !decodeEncryptToggle.checked);
    decodeEncryptToggle.setAttribute('aria-expanded', decodeEncryptToggle.checked);
  });

  setupPasswordToggle(decodePassEye, decodePassword);

  decodeBtn.addEventListener('click', async () => {
    const useDecrypt = decodeEncryptToggle.checked;
    const password = decodePassword.value;

    decodeError.classList.add('hidden');
    decodeNoMsg.classList.add('hidden');
    decodeResult.classList.add('hidden');

    if (!decodedImage) return;
    if (useDecrypt && !password) {
      showError(decodeError, 'Please enter the decryption password.'); return;
    }

    setBtnLoading(decodeBtn, true);
    decodeProgressWrap.classList.remove('hidden');
    setProgress(decodeProgressFill, decodeProgressLabel, 0, 'Extracting bits...');

    try {
      await new Promise(r => setTimeout(r, 20));

      const { imageData } = imageToImageData(decodedImage);

      setProgress(decodeProgressFill, decodeProgressLabel, 30, 'Reading LSB data...');
      await new Promise(r => setTimeout(r, 20));

      const rawMessage = lsbDecode(imageData);

      setProgress(decodeProgressFill, decodeProgressLabel, 70, 'Processing...');

      if (!rawMessage) {
        decodeProgressWrap.classList.add('hidden');
        decodeNoMsg.classList.remove('hidden');
        return;
      }

      let finalMessage = rawMessage;

      if (useDecrypt) {
        setProgress(decodeProgressFill, decodeProgressLabel, 80, 'Decrypting...');
        try {
          finalMessage = await decryptMessage(rawMessage, password);
        } catch {
          throw new Error('Decryption failed — wrong password or the message was not encrypted.');
        }
      }

      setProgress(decodeProgressFill, decodeProgressLabel, 100, 'Done!');
      await new Promise(r => setTimeout(r, 300));

      decodeProgressWrap.classList.add('hidden');
      decodeMessageOut.textContent = finalMessage;
      decodeResult.classList.remove('hidden');

      // Save for download
      decodeResult._message = finalMessage;

    } catch (err) {
      decodeProgressWrap.classList.add('hidden');
      showError(decodeError, err.message);
    } finally {
      setBtnLoading(decodeBtn, false);
    }
  });

  decodeDownloadBtn.addEventListener('click', () => {
    const msg = decodeResult._message;
    if (!msg) return;
    const blob = new Blob([msg], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hidden_message.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  decodeCopyBtn.addEventListener('click', async () => {
    const msg = decodeResult._message;
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      const orig = decodeCopyBtn.textContent;
      decodeCopyBtn.textContent = '✅ Copied!';
      setTimeout(() => { decodeCopyBtn.textContent = orig; }, 2000);
    } catch {
      showError(decodeError, 'Could not copy to clipboard.');
    }
  });

  decodeResetBtn.addEventListener('click', resetDecode);

  function resetDecode() {
    decodedImage = null;
    decodeFileInput.value = '';
    decodePreview.src = '';
    decodePreview.style.display = 'none';
    decodeDropInner.style.display = '';
    decodeDrop.classList.remove('has-image', 'drag-over');
    decodeEncryptToggle.checked = false;
    decodePassField.classList.add('hidden');
    decodePassword.value = '';
    decodeResult.classList.add('hidden');
    decodeError.classList.add('hidden');
    decodeNoMsg.classList.add('hidden');
    decodeProgressWrap.classList.add('hidden');
    decodeBtn.disabled = true;
  }

  /* =====================
     UTILITY FUNCTIONS
     ===================== */

  function showError(el, msg) {
    el.textContent = '❌ ' + msg;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setProgress(fillEl, labelEl, pct, label) {
    fillEl.style.width = pct + '%';
    labelEl.textContent = label;
  }

  function setBtnLoading(btn, loading) {
    const inner = btn.querySelector('.btn-inner');
    const spinner = btn.querySelector('.btn-spinner');
    if (loading) {
      inner.classList.add('hidden');
      spinner.classList.remove('hidden');
      btn.disabled = true;
    } else {
      inner.classList.remove('hidden');
      spinner.classList.add('hidden');
      btn.disabled = false;
    }
  }

  function setupPasswordToggle(eyeBtn, inputEl) {
    eyeBtn.addEventListener('click', () => {
      const isPassword = inputEl.type === 'password';
      inputEl.type = isPassword ? 'text' : 'password';
      eyeBtn.textContent = isPassword ? '🙈' : '👁';
    });
  }

  /* =====================
     HEADER ACTIVE NAV
     ===================== */
  const sections = [
    { id: 'tool', link: navEncode },
    { id: 'how-it-works', link: null },
  ];

  // Intersection observer for smooth nav active state
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && e.target.id === 'how-it-works') {
        navEncode.classList.remove('active');
        navDecode.classList.remove('active');
      }
    });
  }, { threshold: 0.3 });

  const howSection = document.getElementById('how-it-works');
  if (howSection) observer.observe(howSection);

});
