/**
 * Accessible Form Validation
 * WCAG 2.1 AA Compliant - aria-describedby for error messages
 * Session 250.37 - P2-4
 */

(function() {
  'use strict';

  const errorMessages = {
    valueMissing: {
      fr: 'Ce champ est requis',
      en: 'This field is required',
      es: 'Este campo es obligatorio',
      ar: 'هذا الحقل مطلوب',
      ary: 'هاد الخانة خاصها تتعمر'
    },
    typeMismatch: {
      email: {
        fr: 'Veuillez entrer une adresse email valide',
        en: 'Please enter a valid email address',
        es: 'Por favor, introduzca un correo electrónico válido',
        ar: 'يرجى إدخال عنوان بريد إلكتروني صالح',
        ary: 'دخل إيميل صحيح عافاك'
      },
      url: {
        fr: 'Veuillez entrer une URL valide',
        en: 'Please enter a valid URL',
        es: 'Por favor, introduzca una URL válida',
        ar: 'يرجى إدخال رابط صالح',
        ary: 'دخل لينك صحيح عافاك'
      }
    },
    tooShort: {
      fr: 'Minimum {min} caractères requis',
      en: 'Minimum {min} characters required',
      es: 'Se requieren al menos {min} caracteres',
      ar: 'مطلوب {min} أحرف على الأقل',
      ary: 'خاص على الأقل {min} حروف'
    },
    patternMismatch: {
      fr: 'Format invalide',
      en: 'Invalid format',
      es: 'Formato no válido',
      ar: 'التنسيق غير صالح',
      ary: 'الفورما ماشي صحيحة'
    }
  };

  function getLang() {
    return document.documentElement.lang || 'fr';
  }

  function getMessage(validity, input) {
    const lang = getLang();

    if (validity.valueMissing) {
      return errorMessages.valueMissing[lang] || errorMessages.valueMissing.fr;
    }
    if (validity.typeMismatch) {
      const type = input.type;
      if (errorMessages.typeMismatch[type]) {
        return errorMessages.typeMismatch[type][lang] || errorMessages.typeMismatch[type].fr;
      }
    }
    if (validity.tooShort) {
      const msg = errorMessages.tooShort[lang] || errorMessages.tooShort.fr;
      return msg.replace('{min}', input.minLength);
    }
    if (validity.patternMismatch) {
      return errorMessages.patternMismatch[lang] || errorMessages.patternMismatch.fr;
    }
    return input.validationMessage;
  }

  function createErrorElement(input) {
    const errorId = input.id + '-error';
    let errorEl = document.getElementById(errorId);

    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.id = errorId;
      errorEl.className = 'form-error text-red-400 text-sm mt-1 block';
      errorEl.setAttribute('role', 'alert');
      errorEl.setAttribute('aria-live', 'polite');
      input.parentNode.appendChild(errorEl);
    }

    return errorEl;
  }

  function showError(input, message) {
    const errorEl = createErrorElement(input);
    errorEl.textContent = message;
    input.setAttribute('aria-describedby', errorEl.id);
    input.setAttribute('aria-invalid', 'true');
    input.classList.add('border-red-500');
    input.classList.remove('border-green-500');
  }

  function clearError(input) {
    const errorId = input.id + '-error';
    const errorEl = document.getElementById(errorId);

    if (errorEl) {
      errorEl.textContent = '';
    }

    input.removeAttribute('aria-invalid');
    input.classList.remove('border-red-500');

    if (input.value && input.checkValidity()) {
      input.classList.add('border-green-500');
    }
  }

  function validateInput(input) {
    if (!input.checkValidity()) {
      showError(input, getMessage(input.validity, input));
      return false;
    }
    clearError(input);
    return true;
  }

  function initForm(form) {
    form.setAttribute('novalidate', '');

    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach(function(input) {
      if (!input.id) return;

      input.addEventListener('blur', function() {
        validateInput(input);
      });

      input.addEventListener('input', function() {
        if (input.getAttribute('aria-invalid') === 'true') {
          validateInput(input);
        }
      });
    });

    form.addEventListener('submit', function(e) {
      let isValid = true;

      inputs.forEach(function(input) {
        if (!validateInput(input)) {
          isValid = false;
        }
      });

      if (!isValid) {
        e.preventDefault();
        const firstError = form.querySelector('[aria-invalid="true"]');
        if (firstError) {
          firstError.focus();
        }
      }
    });
  }

  function init() {
    const forms = document.querySelectorAll('form');
    forms.forEach(initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.VocaliaFormValidation = { init: init, validateInput: validateInput };
})();
