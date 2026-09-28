(function () {
  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
      this.__mounted = false;
    }

    setState(nextState) {
      this.state = Object.assign({}, this.state, nextState);
      if (typeof this.render === 'function') {
        this.render();
      }
    }
  }

  function refreshDom(root, instance) {
    if (!root || !instance || typeof instance.renderVals !== 'function') return;
    const values = instance.renderVals();
    applyBindings(root, values, {});
  }

  window.DCLogic = DCLogic;

  function resolveExpression(expression, scope) {
    const value = expression.trim();
    if (!value) return '';
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);

    const normalized = value.replace(/\[(?:["'`])?([^\]"'`]+)(?:["'`])?\]/g, '.$1');
    const parts = normalized.split('.').filter(Boolean);
    let current = scope;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  function resolveTemplateString(template, scope) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, expression) => {
      const resolved = resolveExpression(expression, scope);
      if (typeof resolved === 'function') return resolved;
      return resolved == null ? '' : String(resolved);
    });
  }

  function evaluateBoolean(expression, scope) {
    const resolved = resolveTemplateString(expression, scope);
    if (typeof resolved === 'string') {
      return resolved === 'true' || resolved === '1';
    }
    return !!resolved;
  }

  function applyBindings(node, data, scope) {
    if (!node) return;

    if (node.nodeType === 3) {
      if (/\{\{/.test(node.nodeValue)) {
        node.nodeValue = resolveTemplateString(node.nodeValue, Object.assign({}, data, scope));
      }
      return;
    }

    if (node.nodeType !== 1) return;

    if (node.tagName === 'SC-IF') {
      const shouldRender = evaluateBoolean(node.getAttribute('value') || 'true', Object.assign({}, data, scope));
      const parent = node.parentNode;
      if (!shouldRender) {
        if (parent) {
          const nextSibling = node.nextSibling;
          while (node.firstChild) {
            parent.insertBefore(node.firstChild, nextSibling);
          }
          parent.removeChild(node);
        }
        return;
      }

      const parentNode = node.parentNode;
      const nextSibling = node.nextSibling;
      const fragment = document.createDocumentFragment();
      while (node.firstChild) {
        fragment.appendChild(node.firstChild);
      }
      if (parentNode) {
        parentNode.insertBefore(fragment, nextSibling);
        parentNode.removeChild(node);
      }

      Array.from(parentNode ? parentNode.childNodes : []).forEach((child) => applyBindings(child, data, scope));
      return;
    }

    if (node.tagName === 'SC-FOR') {
      const listExpression = node.getAttribute('list') || '[]';
      const itemName = node.getAttribute('as') || 'item';
      const list = resolveTemplateString(listExpression, Object.assign({}, data, scope));
      const currentList = Array.isArray(list) ? list : [];
      const parent = node.parentNode;

      if (parent) {
        const nextSibling = node.nextSibling;
        const fragment = document.createDocumentFragment();
        currentList.forEach((item, index) => {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = node.innerHTML;
          Array.from(wrapper.childNodes).forEach((child) => {
            const clone = child.cloneNode(true);
            applyBindings(clone, data, Object.assign({}, scope, { [itemName]: item, index: index }));
            fragment.appendChild(clone);
          });
        });
        parent.insertBefore(fragment, nextSibling);
        parent.removeChild(node);
      }
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      if (!attribute.value.includes('{{')) return;
      const resolved = resolveTemplateString(attribute.value, Object.assign({}, data, scope));
      if (attribute.name.toLowerCase() === 'onclick' && typeof resolved === 'function') {
        node.onclick = resolved;
        node.removeAttribute(attribute.name);
        return;
      }
      node.setAttribute(attribute.name, String(resolved));
    });

    Array.from(node.childNodes).forEach((child) => applyBindings(child, data, scope));
  }

  function buildFromComponent() {
    const root = document.querySelector('x-dc');
    const script = document.querySelector('script[data-dc-script]');
    if (!root || !script) return;

    const propsScript = script.getAttribute('data-props') || '{}';
    let props = {};
    try {
      props = JSON.parse(propsScript);
    } catch (error) {
      props = {};
    }

    const source = script.textContent.trim();
    if (!source) return;

    const ComponentClass = new Function('DCLogic', 'return (' + source + ')')(DCLogic);
    const instance = new ComponentClass(props);
    instance.__root = root;

    if (typeof instance.renderVals === 'function') {
      instance.render = function () {
        refreshDom(this.__root, this);
      };
      instance.render();
      instance.__mounted = true;
      if (typeof instance.componentDidMount === 'function') {
        instance.componentDidMount();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', buildFromComponent);
})();
