((global) => {
  /*
   * This class overrides the browser's validation error bubbles, displaying custom
   * error messages for invalid fields instead. To begin validating any form, add the
   * class `show-gl-field-errors` to the form element, and ensure error messages are
   * declared in each inputs' title attribute.
   *
   * Example:
   *
   * <form class='show-gl-field-errors'>
   *  <input type='text' name='username' title='Username is required.'/>
   *</form>
   *
    * */

  const errorMessageClass = 'gl-field-error';
  const inputErrorClass = 'gl-field-error-outline';

  class GlFieldError {
    constructor({ input, formErrors }) {
      this.inputElement = $(input);
      this.inputDomElement = this.inputElement.get(0);
      this.form = formErrors;
      this.errorMessage = this.inputElement.attr('title') || 'This field is required.';
      this.fieldErrorElement = $(`<p class='${errorMessageClass} hide'>${ this.errorMessage }</p>`);

      this.state = {
        valid: false,
        empty: true
      };

      this.initFieldValidation();
    }

    initFieldValidation() {
      // hidden when injected into DOM
      this.inputElement.after(this.fieldErrorElement);
      this.inputElement.off('invalid').on('invalid', this.handleInvalidInput.bind(this));
    }

    renderValidity() {
      this.setClearState();

      if (this.state.valid) {
        return this.setValidState();
      }

      if (this.state.empty) {
        return this.setEmptyState();
      }

      if (!this.state.valid) {
        return this.setInvalidState();
      }

      this.form.focusOnFirstInvalid.apply(this.form);
    }

    handleInvalidInput(event) {
      event.preventDefault();

      this.state.valid = false;
      this.state.empty = false;

      this.renderValidity();

      // For UX, wait til after first invalid submission to check each keyup
      this.inputElement.off('keyup.field_validator')
        .on('keyup.field_validator', this.updateValidityState.bind(this));

    }

    getInputValidity() {
      return this.inputDomElement.validity.valid;
    }

    updateValidityState() {
      const inputVal = this.inputElement.val();
      this.state.empty = !!inputVal.length;
      this.state.valid = this.getInputValidity();
      this.renderValidity();
    }

    setValidState() {
      return this.setClearState();
    }

    setEmptyState() {
      return this.setInvalidState();
    }

    setInvalidState() {
      this.inputElement.addClass(inputErrorClass);
      this.inputElement.siblings('p').hide();
      return this.fieldErrorElement.show();
    }

    setClearState() {
      const inputVal = this.inputElement.val();
      if (!inputVal.split(' ').length) {
        const trimmedInput = this.inputElement.val().trim();
        this.inputElement.val(trimmedInput);
      }
      this.inputElement.removeClass(inputErrorClass);
      this.inputElement.siblings('p').hide();
      this.fieldErrorElement.hide();
    }

    checkFieldValidity(target) {
      return target.validity.valid;
    }
  }

  const customValidationFlag = 'no-gl-field-errors';

  class GlFieldErrors {
    constructor(form) {
      this.form = $(form);
      this.state = {
        inputs: [],
        valid: false
      };
      this.initValidators();
    }

    initValidators () {
      // select all non-hidden inputs in form
      this.state.inputs = this.form.find(':input:not([type=hidden])').toArray()
        .filter((input) => !input.classList.contains(customValidationFlag))
        .map((input) => new GlFieldError({ input, formErrors: this }));

      this.form.on('submit', this.catchInvalidFormSubmit);
    }

    /* Neccessary to prevent intercept and override invalid form submit
     * because Safari & iOS quietly allow form submission when form is invalid
     * and prevents disabling of invalid submit button by application.js */

    catchInvalidFormSubmit (event) {
      if (!event.currentTarget.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    focusOnFirstInvalid () {
      const firstInvalid = this.state.inputs.find((input) => !input.inputDomElement.validity.valid);
      $(firstInvalid).focus();
    }
  }

  global.GlFieldErrors = GlFieldErrors;

})(window.gl || (window.gl = {}));
