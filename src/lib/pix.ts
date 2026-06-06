// Função geradora de payload PIX estático
// Baseado no padrão EMV QRCode

interface PixData {
    key: string;
    city: string;
    name: string;
    amount: number;
    description?: string;
    keyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
}

export function normalizarChavePix(chave: string, tipoSugerido?: string): string {
    if (!chave) return "";

    const chaveLimpa = chave.trim();

    let tipo = tipoSugerido?.toUpperCase() || '';
    const apenasNumeros = chaveLimpa.replace(/\D/g, "");

    if (!tipo) {
        if (chaveLimpa.includes('@')) {
            tipo = 'EMAIL';
        } else if (chaveLimpa.startsWith('+') || (apenasNumeros.length > 11 && apenasNumeros.length < 14)) {
            tipo = 'PHONE';
        } else if (apenasNumeros.length === 11) {
            tipo = 'CPF';
        } else if (apenasNumeros.length === 14) {
            tipo = 'CNPJ';
        } else if (chaveLimpa.length >= 32) {
            tipo = 'EVP';
        } else {
            if (apenasNumeros.length > 0) tipo = 'PHONE';
            else tipo = 'EMAIL';
        }
    }

    switch (tipo) {
        case 'CPF':
            return apenasNumeros.padStart(11, '0');

        case 'CNPJ':
            return apenasNumeros.padStart(14, '0');

        case 'PHONE':
        case 'TELEFONE':
        case 'CELULAR':
            if (chaveLimpa.startsWith('+')) {
                return '+' + chaveLimpa.replace(/\D/g, "");
            }

            if (apenasNumeros.length >= 10 && apenasNumeros.length <= 11) {
                return '+55' + apenasNumeros;
            }

            if (apenasNumeros.length > 11) {
                return '+' + apenasNumeros;
            }

            return '+' + apenasNumeros;

        case 'EMAIL':
        case 'E-MAIL':
            return chaveLimpa.toLowerCase();

        case 'EVP':
        case 'CHAVE_ALEATORIA':
            return chaveLimpa;

        default:
            return chaveLimpa;
    }
}

export function normalizarNomePix(nome: string): string {
    if (!nome) return "RECEBEDOR";

    let normalized = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    normalized = normalized.replace(/[^a-zA-Z0-9\s]/g, "");

    normalized = normalized.trim().replace(/\s+/g, " ");

    if (normalized.length > 25) {
        normalized = normalized.substring(0, 25);
    }

    return normalized || "RECEBEDOR";
}

export function normalizarCidadePix(cidade: string): string {
    if (!cidade) return "BRASILIA";

    let normalized = cidade.replace(/[\s\-\/\(]+[A-Za-z]{2}[\)]?\s*$/, "");

    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    normalized = normalized.replace(/[^a-zA-Z0-9\s]/g, "");

    normalized = normalized.trim().replace(/\s+/g, " ");

    if (normalized.length > 15) {
        normalized = normalized.substring(0, 15).trim();
    }

    return normalized || "BRASILIA";
}

export const generatePixPayload = ({ key, name, city, amount, description, keyType }: PixData): string => {
    const ID_PAYLOAD_FORMAT_INDICATOR = "00";
    const ID_POINT_OF_INITIATION_METHOD = "01";
    const ID_MERCHANT_ACCOUNT_INFORMATION = "26";
    const ID_MERCHANT_ACCOUNT_INFORMATION_GUI = "00";
    const ID_MERCHANT_ACCOUNT_INFORMATION_KEY = "01";
    const ID_MERCHANT_CATEGORY_CODE = "52";
    const ID_TRANSACTION_CURRENCY = "53";
    const ID_TRANSACTION_AMOUNT = "54";
    const ID_COUNTRY_CODE = "58";
    const ID_MERCHANT_NAME = "59";
    const ID_MERCHANT_CITY = "60";
    const ID_ADDITIONAL_DATA_FIELD_TEMPLATE = "62";
    const ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID = "05";
    const ID_CRC16 = "63";

    function getValue(id: string, value: string) {
        const size = String(value.length).padStart(2, "0");
        return id + size + value;
    }

    function getMerchantAccountInfo() {
        const gui = getValue(ID_MERCHANT_ACCOUNT_INFORMATION_GUI, "br.gov.bcb.pix");

        const cleanKey = normalizarChavePix(key, keyType);

        const k = getValue(ID_MERCHANT_ACCOUNT_INFORMATION_KEY, cleanKey);
        return getValue(ID_MERCHANT_ACCOUNT_INFORMATION, gui + k);
    }

    function getAdditionalDataFieldTemplate() {
        let txid = description || '';

        txid = txid.replace(/[^a-zA-Z0-9]/g, '');

        if (!txid) {
            const now = Date.now().toString(36).toUpperCase();
            const random = Math.floor(Math.random() * 1000).toString(36).toUpperCase();
            txid = (now + random).substring(0, 25);
        } else {
            txid = txid.substring(0, 25);
        }

        if (!txid) txid = "***";

        const val = getValue(ID_ADDITIONAL_DATA_FIELD_TEMPLATE_TXID, txid);
        return getValue(ID_ADDITIONAL_DATA_FIELD_TEMPLATE, val);
    }

    function calculateCRC16(payload: string) {
        let crc = 0xFFFF;
        let poly = 0x1021;
        let str = payload + "6304";

        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i) << 8;

            for (let j = 0; j < 8; j++) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ poly) : (crc << 1);
            }
        }

        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    const cleanedName = normalizarNomePix(name);
    const cleanedCity = normalizarCidadePix(city);
    const fixedAmount = amount.toFixed(2);

    let payload =
        getValue(ID_PAYLOAD_FORMAT_INDICATOR, "01") +
        getValue(ID_POINT_OF_INITIATION_METHOD, "12") +
        getMerchantAccountInfo() +
        getValue(ID_MERCHANT_CATEGORY_CODE, "0000") +
        getValue(ID_TRANSACTION_CURRENCY, "986") +
        getValue(ID_TRANSACTION_AMOUNT, fixedAmount) +
        getValue(ID_COUNTRY_CODE, "BR") +
        getValue(ID_MERCHANT_NAME, cleanedName) +
        getValue(ID_MERCHANT_CITY, cleanedCity) +
        getAdditionalDataFieldTemplate();

    const crc16 = calculateCRC16(payload);

    return payload + ID_CRC16 + "04" + crc16;
};
