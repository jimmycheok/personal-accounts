import QRCode from 'qrcode';

class DuitNowService {
  /**
   * Generate DuitNow QR code as data URL
   * Format: DuitNow QR payload for bank transfers
   */
  async generateQR(options) {
    const { amount, reference, businessName, accountNumber } = options;

    // DuitNow QR uses EMVCo format
    const payload = this.buildDuitNowPayload({ amount, reference, businessName, accountNumber });

    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });

    return dataUrl;
  }

  async generateQRBuffer(options) {
    const { amount, reference, businessName, accountNumber } = options;
    const payload = this.buildDuitNowPayload({ amount, reference, businessName, accountNumber });
    return QRCode.toBuffer(payload, { errorCorrectionLevel: 'M', width: 300, margin: 1 });
  }

  buildDuitNowPayload({ amount, reference, businessName, accountNumber }) {
    const formatField = (id, value) => {
      const len = String(value).length.toString().padStart(2, '0');
      return `${id}${len}${value}`;
    };

    // EMVCo standard fields
    const payloadFormatIndicator = formatField('00', '01');
    const pointOfInitiation = formatField('01', '12'); // 11=static, 12=dynamic
    const merchantAccountInfo = formatField('26',
      formatField('00', 'MY.MY') +
      formatField('01', accountNumber || '')
    );
    const merchantCategoryCode = formatField('52', '5999');
    const transactionCurrency = formatField('53', '458'); // MYR = 458
    const transactionAmount = amount ? formatField('54', parseFloat(amount).toFixed(2)) : '';
    const countryCode = formatField('58', 'MY');
    const merchantName = formatField('59', (businessName || 'Business').substring(0, 25));
    const merchantCity = formatField('60', 'MALAYSIA');
    const additionalData = reference ? formatField('62', formatField('05', reference)) : '';

    const payload = [
      payloadFormatIndicator,
      pointOfInitiation,
      merchantAccountInfo,
      merchantCategoryCode,
      transactionCurrency,
      transactionAmount,
      countryCode,
      merchantName,
      merchantCity,
      additionalData,
      '6304', // CRC placeholder
    ].join('');

    const crc = this.calculateCRC16(payload);
    return payload.slice(0, -4) + crc;
  }

  calculateCRC16(data) {
    let crc = 0xFFFF;
    for (const char of data) {
      crc ^= char.charCodeAt(0) << 8;
      for (let i = 0; i < 8; i++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}

export default new DuitNowService();
