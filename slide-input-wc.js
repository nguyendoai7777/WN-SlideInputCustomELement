/**
 * @copyright by andreruffert [(https://github.com/andreruffert/range-slider-element/)]
 *
 * @example <range-slider min="0" max="100" step="1" value="10" oninput="onSlideChange(this)"></range-slider>
 */

(function () {
  const cssText = `   range-slider {
  --element-height: 24px;
  --track-height: 3px;
  --thumb-size: 16px;

  position: relative;
  display: flex;
  align-items: center;
  height: var(--element-height);
  width: 100%;
  min-width: 130px;
  margin: 2px;
  overflow: visible;
  cursor: pointer;

  /* Without this prop capture pointer events will not work on touch devices */
  touch-action: none;
}

range-slider:focus {
  outline: 0;
}

range-slider[disabled] {
  filter: grayscale(1);
  opacity: 0.8;
}

/* Track */
range-slider::before {
  content: "";
  display: block;
  width: 100%;
  height: var(--track-height);
  border-radius: calc(var(--track-height) / 2);
  background: linear-gradient(#6221ea, #6221ea) 0/ var(--value-percent, 0%) 100% no-repeat #c6afe5;
}

range-slider:focus .thumb {
  box-shadow: 0 0 0 0.3em rgba(98, 33, 234, .2);
}

range-slider.touch-active .thumb-wrapper .thumb {
  box-shadow: none;
  transform: scale(1.5);
}

.thumb {
  background: #6221ea;
  border-radius: 50%;
  width: var(--thumb-size);
  height: var(--thumb-size);
  position: absolute;
  bottom: calc(var(--element-height) / 2 - var(--thumb-size) / 2);
  left: var(--value-percent, 0%);
  margin-left: calc(var(--thumb-size) / 2 * -1);
  transition: transform 200ms ease;
  will-change: transform;
  pointer-events: none;
}

.thumb-wrapper {
  position: absolute;
  left: calc(var(--thumb-size) / 2);
  right: calc(var(--thumb-size) / 2);
  bottom: 0;
  height: 0;
  overflow: visible;
}`;
  const style = document.createElement('style');
  style.innerHTML = cssText;
  document.head.appendChild(style);
})();

const REFLECTED_ATTRIBUTES = [
  'min',
  'max',
  'step',
  'value',
  'disabled',
  'value-precision',
];

const ARIA_ATTRIBUTES = {
  value: 'valuenow',
  min: 'valuemin',
  max: 'valuemax',
};

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
  <div class="thumb-wrapper">
    <div class="thumb"></div>
  </div>
`;

class RangeSliderElement extends HTMLElement {
  constructor() {
    super();
    this._ignoreChange = false;
    this._isRTL = this.getAttribute('dir') === 'rtl';
    this._defaultValue = this.value;
  }

  static get observedAttributes() {
    return REFLECTED_ATTRIBUTES;
  }

  get _computedValue() {
    const min = Number(this.min);
    const max = Number(this.max);
    return String(max < min ? min : min + (max - min) / 2);
  }

  get min() {
    return this.getAttribute('min') || '0';
  }
  get max() {
    return this.getAttribute('max') || '100';
  }
  get step() {
    return this.getAttribute('step') || '1';
  }
  get value() {
    return this.getAttribute('value') || this._computedValue;
  }
  get disabled() {
    return this.getAttribute('disabled') || false;
  }
  get valuePrecision() {
    return this.getAttribute('value-precision') || '';
  }
  get defaultValue() {
    return this._defaultValue;
  }

  set min(min) {
    this.setAttribute('min', min);
  }
  set max(max) {
    this.setAttribute('max', max);
  }
  set step(step) {
    this.setAttribute('step', step);
  }
  set value(value) {
    this.setAttribute('value', value);
  }
  set disabled(disabled) {
    this.setAttribute('disabled', disabled);
  }
  set valuePrecision(precision) {
    this.setAttribute('value-precision', precision);
  }
  set defaultValue(value) {
    this._defaultValue = value;
  }
  currentValue = this.value;
  connectedCallback() {
    if (!this.firstChild) {
      this.append(TEMPLATE.content.cloneNode(true));
    }

    this.addEventListener('pointerdown', this._startHandler, false);
    this.addEventListener('pointerup', this._endHandler, false);
    this.addEventListener('keydown', this._keyCodeHandler, false);
    this._update();

    // Aria attributes
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'slider');
    setAriaAttribute(this, 'value', this.value);
    setAriaAttribute(this, 'min', this.min);
    setAriaAttribute(this, 'max', this.max);
  }

  disconnectedCallback() {
    this.removeEventListener('pointerdown', this._startHandler, false);
    this.removeEventListener('pointerup', this._endHandler, false);
    this.removeEventListener('keydown', this._keyCodeHandler, false);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this._ignoreChange) return;
    this._update();
    setAriaAttribute(this, name, newValue);
  }

  _startHandler = (e) => {
    this.focus();
    this.classList.add('touch-active');
    this.setPointerCapture(e.pointerId);
    this.addEventListener('pointermove', this._moveHandler, false);
    this._reflectValue(e);
  };

  _moveHandler = (e) => {
    this._reflectValue(e);
  };

  _endHandler = (e) => {
    this.classList.remove('touch-active');
    this.releasePointerCapture(e.pointerId);
    this.removeEventListener('pointermove', this._moveHandler, false);

    // TODO: check if value changed
    this.dispatchEvent(new Event('change', { bubbles: true }));
  };

  _keyCodeHandler = (e) => {
    const code = e.code;
    const up = ['ArrowUp', 'ArrowRight'].includes(code);
    const down = ['ArrowDown', 'ArrowLeft'].includes(code);

    if (up) {
      e.preventDefault();
      this.stepUp();
    } else if (down) {
      e.preventDefault();
      this.stepDown();
    }
  };

  _reflectValue = (e) => {
    const isRTL = Boolean(this._isRTL);
    const min = Number(this.min);
    const max = Number(this.max);
    const oldValue = this.value;
    const fullWidth = e.target.offsetWidth;
    const offsetX = Math.min(Math.max(e.offsetX, 0), fullWidth);
    const percent = offsetX / fullWidth;
    const percentComplete = isRTL ? 1 - percent : percent;

    // Fit the percentage complete between the range [min,max]
    // by remapping from [0, 1] to [min, min+(max-min)].
    const computedValue = min + percentComplete * (max - min);

    // Constrain value
    const newValue = this._constrainValue(computedValue);

    if (oldValue !== newValue) {
      this.value = newValue;
      this.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  _constrainValue(value) {
    const min = Number(this.min);
    const max = Number(this.max);
    const step = Number(this.step);
    const valuePrecision =
      Number(this.valuePrecision) || getPrescision(this.step) || 0;

    // min, max constrain
    const saveValue = Math.min(Math.max(value, min), max);

    // Rounding in steps
    const nearestValue = Math.round(saveValue / step) * step;

    // Value precision
    const newValue = valuePrecision
      ? nearestValue.toFixed(valuePrecision)
      : Math.round(nearestValue).toString();

    return newValue;
  }

  _update() {
    const isRTL = Boolean(this._isRTL);
    const min = Number(this.min);
    const max = Number(this.max);
    const value = Number(this.value);
    const percent = (100 * (value - min)) / (max - min);
    const percentComplete = isRTL ? 100 - percent : percent;
    this.setAttribute('currentValue', percentComplete);
    this.style.setProperty('--value-percent', percentComplete + '%');
  }

  stepUp(amount = this.step) {
    const oldValue = Number(this.value);
    const newValue = this._constrainValue(oldValue + Number(amount));
    if (oldValue !== newValue) {
      this.value = newValue;
      this.dispatchEvent(new Event('input', { bubbles: true }));
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  stepDown(amount = this.step) {
    const oldValue = Number(this.value);
    const newValue = this._constrainValue(oldValue - Number(amount));
    if (oldValue !== newValue) {
      this.value = newValue;
      this.dispatchEvent(new Event('input', { bubbles: true }));
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function getPrescision(value = '') {
  const afterDecimal = value.split('.')[1];
  return afterDecimal ? afterDecimal.length : 0;
}

function setAriaAttribute(element, name, value) {
  const attributeName = ARIA_ATTRIBUTES[name];
  if (!attributeName) return;
  element.setAttribute(`aria-${attributeName}`, value);
}

const ELEMENT_NAME = 'range-slider';

if (!window.customElements.get(ELEMENT_NAME)) {
  window.RangeSliderElement = RangeSliderElement;
  window.customElements.define(ELEMENT_NAME, RangeSliderElement);
}

export default RangeSliderElement;
