/**
 * AGENCY FINANCIAL CONFIGURATION
 * Single Source of Truth for 3A Automation Banking & Payment Details
 * Extracted from: invoice-generator.cjs
 */

const FINANCIAL_CONFIG = {
    company: {
        name: '3A Automation',
        email: 'contact@3a-automation.com',
        website: 'https://3a-automation.com',
        address: 'Angle Boulevard Zerktouni et Rue Al-Bakri',
        city: 'Casablanca',
        country: 'Maroc',
        ice: '003254687000082' // Example structured ICE
    },

    currencies: {
        MAD: {
            symbol: 'DH',
            name: 'Dirham Marocain',
            region: 'Maroc',
            payment: {
                method: 'CMI / Payzone.ma',
                bank: 'Attijariwafa Bank',
                rib: '007810000000000000000185', // Example structured RIB
                beneficiary: '3A Automation'
            }
        },
        EUR: {
            symbol: '€',
            name: 'Euro',
            region: 'Europe',
            payment: {
                method: 'Virement SEPA (Wise)',
                iban: 'BE** **** **** ****', // Replace with verified IBAN if available
                bic: 'TRWIBEB1XXX',
                bank: 'Wise'
            }
        },
        USD: {
            symbol: '$',
            name: 'US Dollar',
            region: 'International',
            payment: {
                method: 'ACH/Wire (Payoneer)',
                account: '[Payoneer Account]',
                routing: '[ABA Number]',
                swift: '[Swift Code]'
            }
        }
    },

    vatRates: {
        MAD: 0.20,
        EUR: 0,
        USD: 0
    }
};

module.exports = FINANCIAL_CONFIG;
