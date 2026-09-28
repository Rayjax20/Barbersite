(function (global) {
  global.React = global.React || {
    createElement: function (type, props) {
      return { type: type, props: props || {} };
    }
  };
})(window);
