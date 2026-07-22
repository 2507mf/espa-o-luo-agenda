// Gera o payload "Pix Copia e Cola" (padrão BR Code do Banco Central) para um
// pagamento com valor fixo. Formato TLV documentado publicamente pelo Bacen.

const PIX_KEY = "52059018000162";
const MERCHANT_NAME = "MAIARA CARVALHO ACUP"; // máx. 25 caracteres
const MERCHANT_CITY = "RECIFE"; // máx. 15 caracteres

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(amount: number): string {
  const merchantAccountInfo = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", PIX_KEY);

  const additionalData = tlv("05", "***"); // txid genérico, sem referência única

  const withoutCrc =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "12") + // Point of Initiation Method (dinâmico, com valor)
    tlv("26", merchantAccountInfo) + // Merchant Account Info (Pix)
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Currency: BRL
    tlv("54", amount.toFixed(2)) + // Transaction Amount
    tlv("58", "BR") + // Country Code
    tlv("59", MERCHANT_NAME) + // Merchant Name
    tlv("60", MERCHANT_CITY) + // Merchant City
    tlv("62", additionalData) + // Additional Data Field
    "6304"; // CRC id + length, valor calculado a seguir

  return withoutCrc + crc16(withoutCrc);
}
