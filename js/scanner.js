class BarcodeScanner {
  constructor(videoElementId, onScanSuccess) {
    this.videoElement = document.getElementById(videoElementId);
    this.onScanSuccess = onScanSuccess;
    
    const hints = new Map();
    const formats = [
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E,
      ZXing.BarcodeFormat.QR_CODE
    ];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);

    this.codeReader = new ZXing.BrowserMultiFormatReader(hints);
    this.isScanning = false;
  }

  async start() {
    if (this.isScanning) return;

    this.stop();

    const overlay = document.getElementById('scanner-overlay');
    if (overlay) overlay.classList.remove('hidden');

    try {
      this.isScanning = true;

      if (this.videoElement) {
        this.videoElement.setAttribute('playsinline', 'true');
        this.videoElement.setAttribute('webkit-playsinline', 'true');
        this.videoElement.muted = true;
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          focusMode: { ideal: 'continuous' }
        }
      };

      await this.codeReader.decodeFromConstraints(
        constraints,
        this.videoElement,
        (result, err) => {
          if (result && this.isScanning) {
            this.stop();
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            this.onScanSuccess(result.getText());
          }
        }
      );
    } catch (err) {
      console.error('Fast scan constraint error:', err);
      this.startFallback();
    }
  }

  async startFallback() {
    try {
      await this.codeReader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        this.videoElement,
        (result, err) => {
          if (result && this.isScanning) {
            this.stop();
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }
            this.onScanSuccess(result.getText());
          }
        }
      );
    } catch (fallbackErr) {
      console.error('Fallback scan error:', fallbackErr);
      alert('Unable to access camera.');
      this.stop();
    }
  }

  stop() {
    this.isScanning = false;

    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject;
      if (stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
      }
      this.videoElement.srcObject = null;
    }

    if (this.codeReader) {
      this.codeReader.reset();
    }

    const overlay = document.getElementById('scanner-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}
